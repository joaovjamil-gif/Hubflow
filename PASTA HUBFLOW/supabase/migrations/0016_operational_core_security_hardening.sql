-- Corrige o gap encontrado pelo Security Advisor: next_sequence_value é
-- SECURITY DEFINER e não checava se o chamador pertence à organização
-- informada. Um usuário autenticado de outra organização poderia chamá-la
-- direto via RPC e consumir/"queimar" números da sequência de uma empresa
-- que não é a dele. Agora ela recusa se o chamador não for membro daquela
-- organização.
create or replace function public.next_sequence_value(p_organization_id uuid, p_entity text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Sem permissão para gerar numeração para esta organização.';
  end if;

  insert into public.org_sequences (organization_id, entity, next_value)
  values (p_organization_id, p_entity, 2)
  on conflict (organization_id, entity)
  do update set next_value = public.org_sequences.next_value + 1
  returning next_value - 1 into v_value;
  return v_value;
end;
$$;

-- Fixa search_path (apontado pelo advisor) em todas as funções novas desta fase.
create or replace function public.compute_quote_item_subtotal()
returns trigger language plpgsql set search_path = public as $$
begin
  new.subtotal := round(new.quantity * new.unit_price - coalesce(new.discount, 0), 2);
  return new;
end;
$$;

create or replace function public.compute_work_order_item_subtotal()
returns trigger language plpgsql set search_path = public as $$
begin
  new.subtotal := round(new.quantity * new.unit_price, 2);
  return new;
end;
$$;

create or replace function public.recompute_quote_totals()
returns trigger language plpgsql set search_path = public as $$
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

create or replace function public.enforce_quote_status_transition()
returns trigger language plpgsql set search_path = public as $$
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

create or replace function public.enforce_work_order_status_transition()
returns trigger language plpgsql set search_path = public as $$
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

create or replace function public.log_entity_activity()
returns trigger language plpgsql set search_path = public as $$
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

create or replace function public.create_quote(
  p_organization_id uuid, p_customer_id uuid, p_title text, p_description text,
  p_valid_until date, p_discount numeric, p_taxes numeric, p_notes text,
  p_payment_terms text, p_items jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_number text;
  v_quote public.quotes;
  v_item jsonb;
begin
  v_number := '#' || lpad(public.next_sequence_value(p_organization_id, 'quote')::text, 3, '0');

  insert into public.quotes (
    organization_id, customer_id, responsible_id, number, title, description,
    status, valid_until, discount, taxes, notes, payment_terms, created_by, updated_by
  ) values (
    p_organization_id, p_customer_id, auth.uid(), v_number, p_title, p_description,
    'rascunho', p_valid_until, coalesce(p_discount, 0), coalesce(p_taxes, 0), p_notes, p_payment_terms, auth.uid(), auth.uid()
  ) returning * into v_quote;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.quote_items (quote_id, service_id, description, quantity, unit, unit_price, discount, notes)
    values (
      v_quote.id, nullif(v_item->>'service_id', '')::uuid, v_item->>'description',
      coalesce((v_item->>'quantity')::numeric, 1), coalesce(v_item->>'unit', 'un'),
      coalesce((v_item->>'unit_price')::numeric, 0), coalesce((v_item->>'discount')::numeric, 0), v_item->>'notes'
    );
  end loop;

  select * into v_quote from public.quotes where id = v_quote.id;
  return to_jsonb(v_quote);
end;
$$;

create or replace function public.approve_quote(p_quote_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_work_order public.work_orders;
  v_number text;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;
  if v_quote.status not in ('enviado', 'visualizado') then
    raise exception 'Só é possível aprovar orçamentos com status "enviado" ou "visualizado" (status atual: %).', v_quote.status;
  end if;

  update public.quotes set status = 'aprovado', updated_by = auth.uid() where id = p_quote_id returning * into v_quote;

  v_number := 'OS ' || v_quote.number;

  insert into public.work_orders (
    organization_id, customer_id, quote_id, number, title, description,
    status, estimated_amount, opened_at, created_by, updated_by
  ) values (
    v_quote.organization_id, v_quote.customer_id, v_quote.id, v_number,
    coalesce(v_quote.title, v_quote.description), v_quote.description,
    'aberta', v_quote.total_amount, current_date, auth.uid(), auth.uid()
  ) returning * into v_work_order;

  insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, status)
  select v_work_order.id, qi.service_id, qi.description, qi.quantity, qi.unit_price, 'pendente'
  from public.quote_items qi where qi.quote_id = v_quote.id;

  select * into v_work_order from public.work_orders where id = v_work_order.id;
  return jsonb_build_object('quote', to_jsonb(v_quote), 'work_order', to_jsonb(v_work_order));
end;
$$;

create or replace function public.create_work_order(
  p_organization_id uuid, p_customer_id uuid, p_title text, p_description text,
  p_priority text, p_scheduled_date date, p_scheduled_time time, p_execution_address text,
  p_estimated_amount numeric, p_responsible_id uuid, p_items jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_number text;
  v_wo public.work_orders;
  v_item jsonb;
begin
  v_number := 'OS #' || lpad(public.next_sequence_value(p_organization_id, 'work_order')::text, 3, '0');

  insert into public.work_orders (
    organization_id, customer_id, responsible_id, number, title, description,
    priority, status, opened_at, scheduled_date, scheduled_time, execution_address,
    estimated_amount, created_by, updated_by
  ) values (
    p_organization_id, p_customer_id, p_responsible_id, v_number, p_title, p_description,
    coalesce(p_priority, 'media'), 'aberta', current_date, p_scheduled_date, p_scheduled_time, p_execution_address,
    coalesce(p_estimated_amount, 0), auth.uid(), auth.uid()
  ) returning * into v_wo;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.work_order_items (work_order_id, service_id, description, quantity, unit_price, status)
    values (
      v_wo.id, nullif(v_item->>'service_id', '')::uuid, v_item->>'description',
      coalesce((v_item->>'quantity')::numeric, 1), coalesce((v_item->>'unit_price')::numeric, 0), 'pendente'
    );
  end loop;

  select * into v_wo from public.work_orders where id = v_wo.id;
  return to_jsonb(v_wo);
end;
$$;

create or replace function public.complete_work_order(
  p_work_order_id uuid, p_final_amount numeric default null, p_due_date date default null, p_payment_method text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_wo public.work_orders;
  v_ar public.accounts_receivable;
  v_amount numeric;
begin
  select * into v_wo from public.work_orders where id = p_work_order_id for update;
  if not found then
    raise exception 'Ordem de serviço não encontrada.';
  end if;
  if v_wo.status in ('concluida', 'cancelada') then
    raise exception 'Esta ordem de serviço já está "%" e não pode ser concluída novamente.', v_wo.status;
  end if;

  v_amount := coalesce(p_final_amount, v_wo.final_amount, v_wo.estimated_amount, 0);

  update public.work_orders
     set status = 'concluida', completed_at = now(), final_amount = v_amount, updated_by = auth.uid()
   where id = p_work_order_id
   returning * into v_wo;

  if v_amount > 0 then
    insert into public.accounts_receivable (
      organization_id, customer_id, quote_id, work_order_id, description,
      amount, due_date, status, payment_method, created_by
    ) values (
      v_wo.organization_id, v_wo.customer_id, v_wo.quote_id, v_wo.id,
      coalesce(v_wo.title, v_wo.description, v_wo.number),
      v_amount, coalesce(p_due_date, (current_date + interval '15 days')::date),
      'pendente', p_payment_method, auth.uid()
    ) returning * into v_ar;
  end if;

  return jsonb_build_object('work_order', to_jsonb(v_wo), 'account_receivable', case when v_ar.id is null then null else to_jsonb(v_ar) end);
end;
$$;
