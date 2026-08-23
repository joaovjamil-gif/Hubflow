-- Ordens de serviço e seus itens de execução. Uma OS pode nascer de um
-- orçamento aprovado (quote_id) ou ser criada diretamente (quote_id nulo).

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  quote_id uuid references public.quotes(id),
  responsible_id uuid references auth.users(id),
  number text not null,
  title text,
  description text,
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'aberta' check (status in ('aberta','agendada','em_andamento','aguardando','concluida','cancelada')),
  opened_at date not null default current_date,
  scheduled_date date,
  scheduled_time time,
  completed_at timestamptz,
  execution_address text,
  notes text,
  estimated_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_work_orders_updated_at before update on public.work_orders for each row execute function public.set_updated_at();
create index idx_work_orders_org on public.work_orders(organization_id);
create index idx_work_orders_customer on public.work_orders(customer_id);
create index idx_work_orders_status on public.work_orders(status);
create index idx_work_orders_scheduled_date on public.work_orders(scheduled_date);
create unique index uq_work_orders_org_number on public.work_orders(organization_id, number);

alter table public.work_orders enable row level security;
create policy work_orders_select on public.work_orders for select using (public.is_org_member(organization_id));
create policy work_orders_insert on public.work_orders for insert with check (public.is_org_member(organization_id));
create policy work_orders_update on public.work_orders for update using (public.is_org_member(organization_id));
create policy work_orders_delete on public.work_orders for delete using (public.is_org_admin(organization_id));

create table public.work_order_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  service_id uuid references public.services(id),
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  status text not null default 'pendente' check (status in ('pendente','em_andamento','concluido','cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_work_order_items_updated_at before update on public.work_order_items for each row execute function public.set_updated_at();
create index idx_work_order_items_wo on public.work_order_items(work_order_id);

alter table public.work_order_items enable row level security;
create policy work_order_items_select on public.work_order_items for select using (
  exists (select 1 from public.work_orders w where w.id = work_order_items.work_order_id and public.is_org_member(w.organization_id))
);
create policy work_order_items_insert on public.work_order_items for insert with check (
  exists (select 1 from public.work_orders w where w.id = work_order_items.work_order_id and public.is_org_member(w.organization_id))
);
create policy work_order_items_update on public.work_order_items for update using (
  exists (select 1 from public.work_orders w where w.id = work_order_items.work_order_id and public.is_org_member(w.organization_id))
);
create policy work_order_items_delete on public.work_order_items for delete using (
  exists (select 1 from public.work_orders w where w.id = work_order_items.work_order_id and public.is_org_member(w.organization_id))
);
