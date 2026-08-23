-- Identidade: organizações (empresas/tenants), profiles (1:1 com auth.users)
-- e organization_members (papel do usuário dentro de cada organização).
-- Toda a segurança multiempresa do resto do schema depende destas 3 tabelas
-- e das funções helper is_org_member / is_org_admin / user_org_role.

-- ORGANIZATIONS
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  document text,
  email text,
  phone text,
  website text,
  logo_url text,
  address text,
  city text,
  state text,
  zip_code text,
  country text not null default 'BR',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- PROFILES (1:1 auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'active' check (status in ('active','inactive','pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Cria automaticamente um profile quando um novo usuário se cadastra no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ORGANIZATION MEMBERS
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('owner','admin','manager','employee')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create trigger trg_org_members_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

create index idx_org_members_org on public.organization_members(organization_id);
create index idx_org_members_user on public.organization_members(user_id);

-- Funções helper (SECURITY DEFINER: evitam recursão de RLS ao consultar
-- organization_members a partir das policies de outras tabelas).
create or replace function public.is_org_member(p_organization_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner','admin')
  );
$$;

create or replace function public.user_org_role(p_organization_id uuid)
returns text language sql security definer set search_path = public stable as $$
  select m.role from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

-- RLS: profiles
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_org_peers on public.profiles
  for select using (
    exists (
      select 1 from public.organization_members m1
      join public.organization_members m2 on m1.organization_id = m2.organization_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id and m1.status = 'active' and m2.status = 'active'
    )
  );

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- RLS: organizations
alter table public.organizations enable row level security;

create policy organizations_select_member on public.organizations
  for select using (public.is_org_member(id));

create policy organizations_insert_authenticated on public.organizations
  for insert with check (auth.uid() is not null);

create policy organizations_update_admin on public.organizations
  for update using (public.is_org_admin(id));

create policy organizations_delete_owner on public.organizations
  for delete using (public.user_org_role(id) = 'owner');

-- RLS: organization_members
alter table public.organization_members enable row level security;

create policy org_members_select_member on public.organization_members
  for select using (public.is_org_member(organization_id));

create policy org_members_insert_admin on public.organization_members
  for insert with check (
    -- permite que o criador da organização se torne o primeiro membro (owner)
    (user_id = auth.uid() and not exists (
      select 1 from public.organization_members existing
      where existing.organization_id = organization_members.organization_id
    ))
    or public.is_org_admin(organization_id)
  );

create policy org_members_update_admin on public.organization_members
  for update using (public.is_org_admin(organization_id));

create policy org_members_delete_admin on public.organization_members
  for delete using (public.is_org_admin(organization_id) or user_id = auth.uid());
