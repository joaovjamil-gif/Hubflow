create extension if not exists pg_cron;

-- Alertas diários: conta a receber/pagar vencendo (até 2 dias) ou atrasada,
-- OS atrasada (agendada para data passada, ainda ativa). Cada item só gera
-- 1 notificação por dia (checagem de duplicidade por entidade+dia).
create or replace function public.run_daily_alerts()
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from public.accounts_receivable ar
    where ar.status = 'pendente' and ar.due_date between current_date and current_date + 2
      and not exists (select 1 from public.notifications n where n.entity_type = 'accounts_receivable' and n.entity_id = ar.id and n.created_at::date = current_date)
  loop
    perform public.create_notification(r.organization_id, r.created_by, 'Conta a receber vencendo', format('Vencimento em %s: R$ %s', r.due_date, r.amount), 'warning', 'accounts_receivable', r.id);
  end loop;

  for r in
    select * from public.accounts_receivable ar
    where ar.status = 'pendente' and ar.due_date < current_date
      and not exists (select 1 from public.notifications n where n.entity_type = 'accounts_receivable' and n.entity_id = ar.id and n.created_at::date = current_date)
  loop
    perform public.create_notification(r.organization_id, r.created_by, 'Conta a receber atrasada', format('Venceu em %s: R$ %s', r.due_date, r.amount), 'error', 'accounts_receivable', r.id);
  end loop;

  for r in
    select * from public.accounts_payable ap
    where ap.status = 'pendente' and ap.due_date between current_date and current_date + 2
      and not exists (select 1 from public.notifications n where n.entity_type = 'accounts_payable' and n.entity_id = ap.id and n.created_at::date = current_date)
  loop
    perform public.create_notification(r.organization_id, r.created_by, 'Conta a pagar vencendo', format('Vencimento em %s: R$ %s', r.due_date, r.amount), 'warning', 'accounts_payable', r.id);
  end loop;

  for r in
    select * from public.accounts_payable ap
    where ap.status = 'pendente' and ap.due_date < current_date
      and not exists (select 1 from public.notifications n where n.entity_type = 'accounts_payable' and n.entity_id = ap.id and n.created_at::date = current_date)
  loop
    perform public.create_notification(r.organization_id, r.created_by, 'Conta a pagar atrasada', format('Venceu em %s: R$ %s', r.due_date, r.amount), 'error', 'accounts_payable', r.id);
  end loop;

  for r in
    select * from public.work_orders wo
    where wo.scheduled_date < current_date and wo.status not in ('concluida', 'cancelada')
      and not exists (select 1 from public.notifications n where n.entity_type = 'work_orders' and n.entity_id = wo.id and n.created_at::date = current_date)
  loop
    perform public.create_notification(r.organization_id, coalesce(r.responsible_id, r.created_by), 'OS atrasada', format('%s estava agendada para %s.', r.number, r.scheduled_date), 'error', 'work_orders', r.id);
  end loop;
end;
$$;

revoke execute on function public.run_daily_alerts() from public, anon, authenticated;

select cron.schedule('hubflow-daily-alerts', '0 9 * * *', $$select public.run_daily_alerts();$$);
