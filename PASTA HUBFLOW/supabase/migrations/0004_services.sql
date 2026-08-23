-- Catálogo de serviços (e, futuramente, produtos) oferecidos pela organização.

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  category text,
  internal_code text,
  default_price numeric(12,2) not null default 0,
  unit text not null default 'un',
  estimated_duration_minutes integer,
  cost numeric(12,2),
  margin numeric(5,2),
  item_type text not null default 'service' check (item_type in ('service','product')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_services_updated_at before update on public.services for each row execute function public.set_updated_at();
create index idx_services_org on public.services(organization_id);
create index idx_services_active on public.services(is_active);
create unique index uq_services_org_code on public.services(organization_id, internal_code) where internal_code is not null;

alter table public.services enable row level security;
create policy services_select on public.services for select using (public.is_org_member(organization_id));
create policy services_insert on public.services for insert with check (public.is_org_member(organization_id));
create policy services_update on public.services for update using (public.is_org_member(organization_id));
create policy services_delete on public.services for delete using (public.is_org_admin(organization_id));
