-- Fornecedores. Criada antes do módulo financeiro porque accounts_payable
-- referencia suppliers.

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  legal_name text,
  document text,
  email text,
  phone text,
  address text,
  category text,
  notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create index idx_suppliers_org on public.suppliers(organization_id);
create unique index uq_suppliers_org_document on public.suppliers(organization_id, document) where document is not null;

alter table public.suppliers enable row level security;
create policy suppliers_select on public.suppliers for select using (public.is_org_member(organization_id));
create policy suppliers_insert on public.suppliers for insert with check (public.is_org_member(organization_id));
create policy suppliers_update on public.suppliers for update using (public.is_org_member(organization_id));
create policy suppliers_delete on public.suppliers for delete using (public.is_org_admin(organization_id));
