-- Ledger financeiro: sempre que uma conta a receber/pagar é marcada como
-- paga, gera automaticamente um lançamento em `transactions` (o "livro-
-- caixa" único que Fase 2 já previa para relatórios futuros). Isso não
-- depende de nenhuma página lembrar de gravar — é o banco que garante.
create or replace function public.record_receivable_transaction()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'pago' and (old.status is distinct from 'pago') then
    insert into public.transactions (
      organization_id, type, amount, occurred_at, payment_method,
      account_receivable_id, description, created_by
    ) values (
      new.organization_id, 'receita', new.amount, coalesce(new.paid_at, current_date), new.payment_method,
      new.id, new.description, auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger trg_ar_transaction after update on public.accounts_receivable
for each row when (new.status is distinct from old.status) execute function public.record_receivable_transaction();

create or replace function public.record_payable_transaction()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'pago' and (old.status is distinct from 'pago') then
    insert into public.transactions (
      organization_id, type, amount, occurred_at, payment_method,
      account_payable_id, description, created_by
    ) values (
      new.organization_id, 'despesa', new.amount, coalesce(new.paid_at, current_date), new.payment_method,
      new.id, new.description, auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger trg_ap_transaction after update on public.accounts_payable
for each row when (new.status is distinct from old.status) execute function public.record_payable_transaction();

-- Histórico automático também para fornecedores e contas a pagar.
create trigger trg_suppliers_activity after insert or update on public.suppliers
for each row execute function public.log_entity_activity();

create trigger trg_accounts_payable_activity after insert or update on public.accounts_payable
for each row execute function public.log_entity_activity();

-- Agenda: uma OS agendada (data + horário definidos) sincroniza
-- automaticamente um evento em calendar_events — não é preciso criar o
-- evento manualmente. Se a OS for desagendada, o evento é marcado como
-- cancelado (não apagado, preserva histórico).
create unique index uq_calendar_events_work_order on public.calendar_events(work_order_id) where work_order_id is not null;

create or replace function public.sync_work_order_calendar_event()
returns trigger language plpgsql set search_path = public as $$
declare
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_all_day boolean;
  v_status text;
begin
  if new.scheduled_date is null then
    update public.calendar_events set status = 'cancelado', updated_at = now() where work_order_id = new.id;
    return new;
  end if;

  v_all_day := new.scheduled_time is null;
  v_starts_at := (new.scheduled_date::text || ' ' || coalesce(new.scheduled_time::text, '00:00'))::timestamptz;
  v_ends_at := case when new.scheduled_time is not null then v_starts_at + interval '2 hours' else null end;

  v_status := case new.status
    when 'concluida' then 'concluido'
    when 'cancelada' then 'cancelado'
    else 'confirmado'
  end;

  insert into public.calendar_events (
    organization_id, title, description, event_type, customer_id, quote_id, work_order_id,
    responsible_id, starts_at, ends_at, all_day, location, status, created_by
  ) values (
    new.organization_id, coalesce(new.title, new.number), new.description, 'servico', new.customer_id, new.quote_id, new.id,
    new.responsible_id, v_starts_at, v_ends_at, v_all_day, new.execution_address, v_status, new.updated_by
  )
  on conflict (work_order_id) where work_order_id is not null
  do update set
    title = excluded.title,
    customer_id = excluded.customer_id,
    responsible_id = excluded.responsible_id,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    all_day = excluded.all_day,
    location = excluded.location,
    status = excluded.status,
    updated_at = now();

  return new;
end;
$$;

-- INSERT: sempre roda (não existe OLD para comparar).
create trigger trg_work_orders_calendar_sync_insert
after insert on public.work_orders
for each row execute function public.sync_work_order_calendar_event();

-- UPDATE: só roda quando algo relevante ao evento realmente mudou.
create trigger trg_work_orders_calendar_sync_update
after update on public.work_orders
for each row
when (
  new.scheduled_date is distinct from old.scheduled_date or
  new.scheduled_time is distinct from old.scheduled_time or
  new.status is distinct from old.status or
  new.title is distinct from old.title or
  new.responsible_id is distinct from old.responsible_id or
  new.execution_address is distinct from old.execution_address
)
execute function public.sync_work_order_calendar_event();
