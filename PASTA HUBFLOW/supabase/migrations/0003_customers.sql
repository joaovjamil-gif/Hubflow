-- Clientes (pessoa física ou jurídica) e seus contatos adicionais.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trade_name text,
  document text,
  customer_type text not null default 'pessoa_fisica' check (customer_type in ('pessoa_fisica','pessoa_juridica')),
  email text,
  phone text,
  mobile_phone text,
  whatsapp text,
  address text,
  address_number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  notes text,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

create index idx_customers_org on public.customers(organization_id);
create index idx_customers_status on public.customers(status);
create index idx_customers_document on public.customers(document);
create index idx_customers_email on public.customers(email);
create unique index uq_customers_org_document on public.customers(organization_id, document) where document is not null;

alter table public.customers enable row level security;
create policy customers_select on public.customers for select using (public.is_org_member(organization_id));
create policy customers_insert on public.customers for insert with check (public.is_org_member(organization_id));
create policy customers_update on public.customers for update using (public.is_org_member(organization_id));
create policy customers_delete on public.customers for delete using (public.is_org_admin(organization_id));

-- CUSTOMER CONTACTS
create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_customer_contacts_updated_at before update on public.customer_contacts for each row execute function public.set_updated_at();
create index idx_customer_contacts_customer on public.customer_contacts(customer_id);

alter table public.customer_contacts enable row level security;
create policy customer_contacts_select on public.customer_contacts for select using (
  exists (select 1 from public.customers c where c.id = customer_contacts.customer_id and public.is_org_member(c.organization_id))
);
create policy customer_contacts_insert on public.customer_contacts for insert with check (
  exists (select 1 from public.customers c where c.id = customer_contacts.customer_id and public.is_org_member(c.organization_id))
);
create policy customer_contacts_update on public.customer_contacts for update using (
  exists (select 1 from public.customers c where c.id = customer_contacts.customer_id and public.is_org_member(c.organization_id))
);
create policy customer_contacts_delete on public.customer_contacts for delete using (
  exists (select 1 from public.customers c where c.id = customer_contacts.customer_id and public.is_org_member(c.organization_id))
);
