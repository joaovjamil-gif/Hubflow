// src/services/workOrders.js
//
// Ordens de serviço (work_orders) — conectado ao Supabase. Substitui o
// mock antigo de ordensServicoApi. As transições de status são validadas
// pelo banco (enforce_work_order_status_transition, ver
// supabase/migrations/0014_...) — um update para um status inválido é
// rejeitado com erro, não só "escondido" na UI.

import { supabase } from './supabaseClient.js';

function formatTime(t) {
  if (!t) return null;
  return t.slice(0, 5); // "09:00:00" -> "09:00"
}

function workOrderFromDb(row) {
  return {
    id: row.id,
    cliente_id: row.customer_id,
    orcamento_id: row.quote_id,
    responsavel_id: row.responsible_id,
    numero: row.number,
    titulo: row.title,
    servico: row.title,
    descricao: row.description,
    prioridade: row.priority,
    status: row.status,
    data_abertura: row.opened_at,
    data: row.scheduled_date,
    horario: formatTime(row.scheduled_time),
    data_prevista: row.scheduled_date,
    hora_prevista: formatTime(row.scheduled_time),
    data_conclusao: row.completed_at,
    endereco: row.execution_address || '',
    observacoes: row.notes || '',
    valor: Number(row.estimated_amount) || 0,
    valor_estimado: Number(row.estimated_amount) || 0,
    valor_final: row.final_amount === null ? null : Number(row.final_amount),
    criado_em: row.created_at ? row.created_at.slice(0, 10) : '',
    atualizado_em: row.updated_at ? row.updated_at.slice(0, 10) : '',
  };
}

function itemFromDb(row) {
  return {
    id: row.id,
    servico_id: row.service_id,
    descricao: row.description,
    quantidade: Number(row.quantity) || 0,
    preco_unitario: Number(row.unit_price) || 0,
    subtotal: Number(row.subtotal) || 0,
    status: row.status,
  };
}

export const workOrdersApi = {
  list: async (organizationId) => {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(workOrderFromDb);
  },

  get: async (id) => {
    const { data, error } = await supabase.from('work_orders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? workOrderFromDb(data) : null;
  },

  listItems: async (workOrderId) => {
    const { data, error } = await supabase
      .from('work_order_items')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(itemFromDb);
  },

  addItem: async (workOrderId, item) => {
    const { data, error } = await supabase
      .from('work_order_items')
      .insert({
        work_order_id: workOrderId,
        description: item.descricao,
        quantity: Number(item.quantidade) || 1,
        unit_price: Number(item.preco_unitario) || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return itemFromDb(data);
  },

  /** Cria uma OS manualmente (sem orçamento de origem), com itens, numeração própria. */
  create: async (organizationId, form, items) => {
    const { data, error } = await supabase.rpc('create_work_order', {
      p_organization_id: organizationId,
      p_customer_id: form.cliente_id,
      p_title: form.titulo || null,
      p_description: form.descricao || null,
      p_priority: form.prioridade || 'media',
      p_scheduled_date: form.data_prevista || null,
      p_scheduled_time: form.hora_prevista || null,
      p_execution_address: form.endereco || null,
      p_estimated_amount: Number(form.valor_estimado) || 0,
      p_responsible_id: form.responsavel_id || null,
      p_items: (items || []).map((it) => ({
        description: it.descricao,
        quantity: Number(it.quantidade) || 1,
        unit_price: Number(it.preco_unitario) || 0,
      })),
    });
    if (error) throw error;
    return workOrderFromDb(data);
  },

  /** Transições simples (agendada/em_andamento/aguardando/cancelada) — o banco valida se é permitida. */
  updateStatus: async (id, status, extra = {}) => {
    const patch = { status };
    if (extra.data_prevista !== undefined) patch.scheduled_date = extra.data_prevista || null;
    if (extra.hora_prevista !== undefined) patch.scheduled_time = extra.hora_prevista || null;
    if (extra.responsavel_id !== undefined) patch.responsible_id = extra.responsavel_id || null;
    const { data, error } = await supabase.from('work_orders').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return workOrderFromDb(data);
  },

  /** Conclui a OS e gera o lançamento financeiro correspondente (RPC atômica). */
  complete: async (id, { valorFinal, vencimento, formaPagamento } = {}) => {
    const { data, error } = await supabase.rpc('complete_work_order', {
      p_work_order_id: id,
      p_final_amount: valorFinal === undefined || valorFinal === '' ? null : Number(valorFinal),
      p_due_date: vencimento || null,
      p_payment_method: formaPagamento || null,
    });
    if (error) throw error;
    return {
      ordemServico: workOrderFromDb(data.work_order),
      lancamento: data.account_receivable,
    };
  },
};
