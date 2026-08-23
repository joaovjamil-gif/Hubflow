create or replace function public.create_notification(
  p_organization_id uuid, p_user_id uuid, p_title text, p_message text,
  p_type text, p_entity_type text, p_entity_id uuid
) returns void language plpgsql set search_path = public as $$
begin
  if p_user_id is null then return; end if;
  insert into public.notifications (organization_id, user_id, title, message, type, entity_type, entity_id)
  values (p_organization_id, p_user_id, p_title, p_message, coalesce(p_type, 'info'), p_entity_type, p_entity_id);
end;
$$;

revoke execute on function public.create_notification(uuid, uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.create_notification(uuid, uuid, text, text, text, text, uuid) to authenticated;

-- Orçamento aprovado/recusado
create or replace function public.notify_quote_events()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'aprovado' then
    perform public.create_notification(new.organization_id, new.responsible_id, 'Orçamento aprovado', format('Orçamento %s foi aprovado.', new.number), 'success', 'quotes', new.id);
  elsif new.status = 'recusado' then
    perform public.create_notification(new.organization_id, new.responsible_id, 'Orçamento recusado', format('Orçamento %s foi recusado.', new.number), 'warning', 'quotes', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_notify_quote_events after update on public.quotes
for each row when (new.status is distinct from old.status) execute function public.notify_quote_events();

-- OS: criada com responsável, atribuída, agendada, concluída
create or replace function public.notify_work_order_events()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.responsible_id is not null then
      perform public.create_notification(new.organization_id, new.responsible_id, 'Nova OS atribuída', format('Você foi atribuído à %s.', new.number), 'info', 'work_orders', new.id);
    end if;
    return new;
  end if;

  if new.responsible_id is distinct from old.responsible_id and new.responsible_id is not null then
    perform public.create_notification(new.organization_id, new.responsible_id, 'OS atribuída a você', format('Você foi atribuído à %s.', new.number), 'info', 'work_orders', new.id);
  end if;

  if new.status is distinct from old.status then
    if new.status = 'agendada' then
      perform public.create_notification(new.organization_id, new.responsible_id, 'OS agendada', format('%s foi agendada para %s.', new.number, new.scheduled_date), 'info', 'work_orders', new.id);
    elsif new.status = 'concluida' then
      perform public.create_notification(new.organization_id, coalesce(new.responsible_id, new.created_by), 'OS concluída', format('%s foi concluída.', new.number), 'success', 'work_orders', new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notify_wo_insert after insert on public.work_orders
for each row execute function public.notify_work_order_events();

create trigger trg_notify_wo_update after update on public.work_orders
for each row when (new.status is distinct from old.status or new.responsible_id is distinct from old.responsible_id)
execute function public.notify_work_order_events();

-- Pagamentos (recebido / realizado)
create or replace function public.notify_receivable_paid()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'pago' and old.status is distinct from 'pago' then
    perform public.create_notification(new.organization_id, coalesce(new.created_by, auth.uid()), 'Pagamento recebido', format('Recebimento de R$ %s confirmado.', new.amount), 'success', 'accounts_receivable', new.id);
  end if;
  return new;
end;
$$;
create trigger trg_notify_receivable_paid after update on public.accounts_receivable
for each row when (new.status is distinct from old.status) execute function public.notify_receivable_paid();

create or replace function public.notify_payable_paid()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'pago' and old.status is distinct from 'pago' then
    perform public.create_notification(new.organization_id, coalesce(new.created_by, auth.uid()), 'Pagamento realizado', format('Pagamento de R$ %s confirmado.', new.amount), 'success', 'accounts_payable', new.id);
  end if;
  return new;
end;
$$;
create trigger trg_notify_payable_paid after update on public.accounts_payable
for each row when (new.status is distinct from old.status) execute function public.notify_payable_paid();
