-- Módulo financeiro: categorias, centros de custo, contas a receber,
-- contas a pagar e transações (fluxo de caixa centralizado).

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null check (type in ('receita','despesa')),
  created_at timestamptz not null default now()
);
create index idx_financial_categories_org on public.financial_categories(organization_id);
alter table public.financial_categories enable row level security;
create policy financial_categories_select on public.financial_categories for select using (public.is_org_member(organization_id));
create policy financial_categories_insert on public.financial_categories for insert with check (public.is_org_member(organization_id));
create policy financial_categories_update on public.financial_categories for update using (public.is_org_member(organization_id));
create policy financial_categories_delete on public.financial_categories for delete using (public.is_org_admin(organization_id));

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index idx_cost_centers_org on public.cost_centers(organization_id);
alter table public.cost_centers enable row level security;
create policy cost_centers_select on public.cost_centers for select using (public.is_org_member(organization_id));
create policy cost_centers_insert on public.cost_centers for insert with check (public.is_org_member(organization_id));
create policy cost_centers_update on public.cost_centers for update using (public.is_org_member(organization_id));
create policy cost_centers_delete on public.cost_centers for delete using (public.is_org_admin(organization_id));

create table public.accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id),
  quote_id uuid references public.quotes(id),
  work_order_id uuid references public.work_orders(id),
  description text not null,
  amount numeric(12,2) not null,
  due_date date not null,
  paid_at date,
  status text not null default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
  payment_method text check (payment_method in ('dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia','outro')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger trg_ar_updated_at before update on public.accounts_receivable for each row execute function public.set_updated_at();
create index idx_ar_org on public.accounts_receivable(organization_id);
create index idx_ar_status on public.accounts_receivable(status);
create index idx_ar_due_date on public.accounts_receivable(due_date);
create index idx_ar_customer on public.accounts_receivable(customer_id);
alter table public.accounts_receivable enable row level security;
create policy ar_select on public.accounts_receivable for select using (public.is_org_member(organization_id));
create policy ar_insert on public.accounts_receivable for insert with check (public.is_org_member(organization_id));
create policy ar_update on public.accounts_receivable for update using (public.is_org_member(organization_id));
create policy ar_delete on public.accounts_receivable for delete using (public.is_org_admin(organization_id));

create table public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  description text not null,
  category text,
  amount numeric(12,2) not null,
  due_date date not null,
  paid_at date,
  status text not null default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
  payment_method text check (payment_method in ('dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia','outro')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger trg_ap_updated_at before update on public.accounts_payable for each row execute function public.set_updated_at();
create index idx_ap_org on public.accounts_payable(organization_id);
create index idx_ap_status on public.accounts_payable(status);
create index idx_ap_due_date on public.accounts_payable(due_date);
alter table public.accounts_payable enable row level security;
create policy ap_select on public.accounts_payable for select using (public.is_org_member(organization_id));
create policy ap_insert on public.accounts_payable for insert with check (public.is_org_member(organization_id));
create policy ap_update on public.accounts_payable for update using (public.is_org_member(organization_id));
create policy ap_delete on public.accounts_payable for delete using (public.is_org_admin(organization_id));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('receita','despesa')),
  amount numeric(12,2) not null,
  occurred_at date not null default current_date,
  category_id uuid references public.financial_categories(id),
  cost_center_id uuid references public.cost_centers(id),
  payment_method text check (payment_method in ('dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia','outro')),
  account_receivable_id uuid references public.accounts_receivable(id),
  account_payable_id uuid references public.accounts_payable(id),
  description text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create index idx_transactions_org on public.transactions(organization_id);
create index idx_transactions_occurred_at on public.transactions(occurred_at);
alter table public.transactions enable row level security;
create policy transactions_select on public.transactions for select using (public.is_org_member(organization_id));
create policy transactions_insert on public.transactions for insert with check (public.is_org_member(organization_id));
create policy transactions_update on public.transactions for update using (public.is_org_member(organization_id));
create policy transactions_delete on public.transactions for delete using (public.is_org_admin(organization_id));
