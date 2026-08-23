-- Numeração automática por organização (orçamentos manuais e OS manuais).
create table public.org_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity text not null,
  next_value integer not null default 1,
  primary key (organization_id, entity)
);

alter table public.org_sequences enable row level security;
create policy org_sequences_select on public.org_sequences for select using (public.is_org_member(organization_id));
-- Sem policy de insert/update para usuários: só a função abaixo (SECURITY DEFINER) escreve aqui.

create or replace function public.next_sequence_value(p_organization_id uuid, p_entity text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  insert into public.org_sequences (organization_id, entity, next_value)
  values (p_organization_id, p_entity, 2)
  on conflict (organization_id, entity)
  do update set next_value = public.org_sequences.next_value + 1
  returning next_value - 1 into v_value;
  return v_value;
end;
$$;

revoke execute on function public.next_sequence_value(uuid, text) from public, anon;
grant execute on function public.next_sequence_value(uuid, text) to authenticated;

-- Itens de OS também passam a ter subtotal (faltava, comparado a quote_items).
alter table public.work_order_items add column subtotal numeric(12,2) not null default 0;

-- Subtotal de item sempre calculado no servidor (nunca confia no valor enviado pelo cliente).
create or replace function public.compute_quote_item_subtotal()
returns trigger language plpgsql as $$
begin
  new.subtotal := round(new.quantity * new.unit_price - coalesce(new.discount, 0), 2);
  return new;
end;
$$;

create trigger trg_quote_items_subtotal
before insert or update on public.quote_items
for each row execute function public.compute_quote_item_subtotal();

create or replace function public.compute_work_order_item_subtotal()
returns trigger language plpgsql as $$
begin
  new.subtotal := round(new.quantity * new.unit_price, 2);
  return new;
end;
$$;

create trigger trg_work_order_items_subtotal
before insert or update on public.work_order_items
for each row execute function public.compute_work_order_item_subtotal();

-- Totais do orçamento (subtotal/total_amount) sempre recalculados a partir
-- dos itens reais — nunca confiamos num total digitado à mão pelo cliente.
create or replace function public.recompute_quote_totals()
returns trigger language plpgsql as $$
declare
  v_quote_id uuid := coalesce(new.quote_id, old.quote_id);
  v_subtotal numeric(12,2);
begin
  select coalesce(sum(subtotal), 0) into v_subtotal from public.quote_items where quote_id = v_quote_id;
  update public.quotes
     set subtotal = v_subtotal,
         total_amount = greatest(v_subtotal - coalesce(discount, 0) + coalesce(taxes, 0), 0)
   where id = v_quote_id;
  return null;
end;
$$;

create trigger trg_quote_items_recompute
after insert or update or delete on public.quote_items
for each row execute function public.recompute_quote_totals();

-- Transições de status controladas no banco (não apenas na UI).
create or replace function public.enforce_quote_status_transition()
returns trigger language plpgsql as $$
declare
  v_allowed text[];
begin
  if new.status = old.status then
    return new;
  end if;
  v_allowed := case old.status
    when 'rascunho' then array['enviado','cancelado']
    when 'enviado' then array['visualizado','aprovado','recusado','expirado','cancelado']
    when 'visualizado' then array['aprovado','recusado','expirado','cancelado']
    when 'aprovado' then array['cancelado']
    when 'recusado' then array['rascunho','cancelado']
    when 'expirado' then array['rascunho','cancelado']
    when 'cancelado' then array[]::text[]
    else array[]::text[]
  end;
  if not (new.status = any(v_allowed)) then
    raise exception 'Transição de status inválida para orçamento: % -> %', old.status, new.status;
  end if;
  return new;
end;
$$;

create trigger trg_quotes_status_transition
before update on public.quotes
for each row execute function public.enforce_quote_status_transition();

create or replace function public.enforce_work_order_status_transition()
returns trigger language plpgsql as $$
declare
  v_allowed text[];
begin
  if new.status = old.status then
    return new;
  end if;
  v_allowed := case old.status
    when 'aberta' then array['agendada','em_andamento','aguardando','concluida','cancelada']
    when 'agendada' then array['em_andamento','aguardando','concluida','cancelada']
    when 'em_andamento' then array['aguardando','concluida','cancelada']
    when 'aguardando' then array['em_andamento','concluida','cancelada']
    when 'concluida' then array[]::text[]
    when 'cancelada' then array[]::text[]
    else array[]::text[]
  end;
  if not (new.status = any(v_allowed)) then
    raise exception 'Transição de status inválida para ordem de serviço: % -> %', old.status, new.status;
  end if;
  return new;
end;
$$;

create trigger trg_work_orders_status_transition
before update on public.work_orders
for each row execute function public.enforce_work_order_status_transition();

-- Histórico automático (activity_logs) para as entidades do núcleo
-- operacional — não depende de nenhuma página lembrar de registrar.
create or replace function public.log_entity_activity()
returns trigger language plpgsql as $$
declare
  v_action text;
  v_description text;
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_logs(organization_id, user_id, entity_type, entity_id, action, description, new_data)
    values (new.organization_id, auth.uid(), TG_TABLE_NAME, new.id, 'create', format('%s criado(a)', TG_TABLE_NAME), to_jsonb(new));
    return new;
  elsif TG_OP = 'UPDATE' then
    if new.status is distinct from old.status then
      v_action := case new.status
        when 'aprovado' then 'approve'
        when 'recusado' then 'reject'
        when 'concluida' then 'complete'
        when 'pago' then 'complete'
        when 'cancelado' then 'cancel'
        when 'cancelada' then 'cancel'
        else 'update'
      end;
      v_description := format('Status alterado de "%s" para "%s"', old.status, new.status);
      insert into public.activity_logs(organization_id, user_id, entity_type, entity_id, action, description, old_data, new_data)
      values (new.organization_id, auth.uid(), TG_TABLE_NAME, new.id, v_action, v_description, to_jsonb(old), to_jsonb(new));
    end if;
    return new;
  end if;
  return new;
end;
$$;

create trigger trg_customers_activity after insert or update on public.customers for each row execute function public.log_entity_activity();
create trigger trg_quotes_activity after insert or update on public.quotes for each row execute function public.log_entity_activity();
create trigger trg_work_orders_activity after insert or update on public.work_orders for each row execute function public.log_entity_activity();
create trigger trg_accounts_receivable_activity after insert or update on public.accounts_receivable for each row execute function public.log_entity_activity();
