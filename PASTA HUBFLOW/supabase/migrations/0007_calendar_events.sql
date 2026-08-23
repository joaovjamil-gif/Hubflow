-- Agenda real (não é mais apenas uma leitura de OS). Uma OS com data/horário
-- pode gerar um calendar_event (work_order_id preenchido), mas a agenda
-- também aceita eventos independentes (reunião, lembrete, etc.).

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'servico' check (event_type in ('reuniao','visita','servico','lembrete','outro')),
  customer_id uuid references public.customers(id),
  quote_id uuid references public.quotes(id),
  work_order_id uuid references public.work_orders(id),
  responsible_id uuid references auth.users(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  status text not null default 'confirmado' check (status in ('confirmado','pendente','cancelado','concluido')),
  reminder_minutes_before integer,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_calendar_events_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
create index idx_calendar_events_org on public.calendar_events(organization_id);
create index idx_calendar_events_starts_at on public.calendar_events(starts_at);
create index idx_calendar_events_customer on public.calendar_events(customer_id);
create index idx_calendar_events_work_order on public.calendar_events(work_order_id);

alter table public.calendar_events enable row level security;
create policy calendar_events_select on public.calendar_events for select using (public.is_org_member(organization_id));
create policy calendar_events_insert on public.calendar_events for insert with check (public.is_org_member(organization_id));
create policy calendar_events_update on public.calendar_events for update using (public.is_org_member(organization_id));
create policy calendar_events_delete on public.calendar_events for delete using (public.is_org_member(organization_id));
