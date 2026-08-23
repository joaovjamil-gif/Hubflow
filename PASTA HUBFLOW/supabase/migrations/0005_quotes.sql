-- Orçamentos e seus itens de linha.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  responsible_id uuid references auth.users(id),
  number text not null,
  title text,
  description text,
  status text not null default 'rascunho' check (status in ('rascunho','enviado','visualizado','aprovado','recusado','expirado','cancelado')),
  valid_until date,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  taxes numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text,
  payment_terms text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_quotes_updated_at before update on public.quotes for each row execute function public.set_updated_at();
create index idx_quotes_org on public.quotes(organization_id);
create index idx_quotes_customer on public.quotes(customer_id);
create index idx_quotes_status on public.quotes(status);
create unique index uq_quotes_org_number on public.quotes(organization_id, number);

alter table public.quotes enable row level security;
create policy quotes_select on public.quotes for select using (public.is_org_member(organization_id));
create policy quotes_insert on public.quotes for insert with check (public.is_org_member(organization_id));
create policy quotes_update on public.quotes for update using (public.is_org_member(organization_id));
create policy quotes_delete on public.quotes for delete using (public.is_org_admin(organization_id));

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  service_id uuid references public.services(id),
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'un',
  unit_price numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_quote_items_updated_at before update on public.quote_items for each row execute function public.set_updated_at();
create index idx_quote_items_quote on public.quote_items(quote_id);

alter table public.quote_items enable row level security;
create policy quote_items_select on public.quote_items for select using (
  exists (select 1 from public.quotes q where q.id = quote_items.quote_id and public.is_org_member(q.organization_id))
);
create policy quote_items_insert on public.quote_items for insert with check (
  exists (select 1 from public.quotes q where q.id = quote_items.quote_id and public.is_org_member(q.organization_id))
);
create policy quote_items_update on public.quote_items for update using (
  exists (select 1 from public.quotes q where q.id = quote_items.quote_id and public.is_org_member(q.organization_id))
);
create policy quote_items_delete on public.quote_items for delete using (
  exists (select 1 from public.quotes q where q.id = quote_items.quote_id and public.is_org_member(q.organization_id))
);
