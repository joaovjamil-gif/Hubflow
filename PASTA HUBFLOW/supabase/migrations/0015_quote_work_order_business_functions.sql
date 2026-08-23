-- Cria um orçamento e seus itens numa única transação (numeração automática,
-- totais calculados pelos triggers da migration anterior).
create or replace function public.create_quote(
  p_organization_id uuid,
  p_customer_id uuid,
  p_title text,
  p_description text,
  p_valid_until date,
  p_discount numeric,
  p_taxes numeric,
  p_notes text,
  p_payment_terms text,
  p_items jsonb
)
returns jsonb
language plpgsql
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
      v_quote.id,
      nullif(v_item->>'service_id', '')::uuid,
      v_item->>'description',
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce(v_item->>'unit', 'un'),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'discount')::numeric, 0),
      v_item->>'notes'
    );
  end loop;

  select * into v_quote from public.quotes where id = v_quote.id;
  return to_jsonb(v_quote);
end;
$$;

-- Aprova um orçamento e gera a OS pré-preenchida (com os itens copiados),
-- de forma atômica. Só aprova orçamentos que já foram enviados ao cliente.
create or replace function public.approve_quote(p_quote_id uuid)
returns jsonb
language plpgsql
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

  update public.quotes
     set status = 'aprovado', updated_by = auth.uid()
   where id = p_quote_id
   returning * into v_quote;

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
  from public.quote_items qi
  where qi.quote_id = v_quote.id;

  select * into v_work_order from public.work_orders where id = v_work_order.id;

  return jsonb_build_object('quote', to_jsonb(v_quote), 'work_order', to_jsonb(v_work_order));
end;
$$;

-- Cria uma OS manualmente (sem orçamento de origem), com itens, numeração
-- automática própria.
create or replace function public.create_work_order(
  p_organization_id uuid,
  p_customer_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_scheduled_date date,
  p_scheduled_time time,
  p_execution_address text,
  p_estimated_amount numeric,
  p_responsible_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
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
      v_wo.id,
      nullif(v_item->>'service_id', '')::uuid,
      v_item->>'description',
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce((v_item->>'unit_price')::numeric, 0),
      'pendente'
    );
  end loop;

  select * into v_wo from public.work_orders where id = v_wo.id;
  return to_jsonb(v_wo);
end;
$$;

-- Conclui uma OS e gera o lançamento financeiro (accounts_receivable)
-- correspondente, de forma atômica. Bloqueia conclusão dupla.
create or replace function public.complete_work_order(
  p_work_order_id uuid,
  p_final_amount numeric default null,
  p_due_date date default null,
  p_payment_method text default null
)
returns jsonb
language plpgsql
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
     set status = 'concluida',
         completed_at = now(),
         final_amount = v_amount,
         updated_by = auth.uid()
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

  return jsonb_build_object(
    'work_order', to_jsonb(v_wo),
    'account_receivable', case when v_ar.id is null then null else to_jsonb(v_ar) end
  );
end;
$$;

revoke execute on function public.create_quote(uuid, uuid, text, text, date, numeric, numeric, text, text, jsonb) from public, anon;
grant execute on function public.create_quote(uuid, uuid, text, text, date, numeric, numeric, text, text, jsonb) to authenticated;

revoke execute on function public.approve_quote(uuid) from public, anon;
grant execute on function public.approve_quote(uuid) to authenticated;

revoke execute on function public.create_work_order(uuid, uuid, text, text, text, date, time, text, numeric, uuid, jsonb) from public, anon;
grant execute on function public.create_work_order(uuid, uuid, text, text, text, date, time, text, numeric, uuid, jsonb) to authenticated;

revoke execute on function public.complete_work_order(uuid, numeric, date, text) from public, anon;
grant execute on function public.complete_work_order(uuid, numeric, date, text) to authenticated;
