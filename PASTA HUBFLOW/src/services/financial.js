// src/services/financial.js
//
// Contas a receber (accounts_receivable) — conectado ao Supabase. Nascem
// automaticamente quando uma OS é concluída (ver
// src/services/workOrders.js -> complete(), que chama a RPC
// complete_work_order). Esta camada só lê e permite marcar como pago.

import { supabase } from './supabaseClient.js';

function receivableFromDb(row) {
  return {
    id: row.id,
    cliente_id: row.customer_id,
    orcamento_id: row.quote_id,
    ordem_servico_id: row.work_order_id,
    descricao: row.description,
    valor: Number(row.amount) || 0,
    vencimento: row.due_date,
    pago_em: row.paid_at,
    status: row.status,
    forma_pagamento: row.payment_method,
    observacoes: row.notes,
    criado_em: row.created_at ? row.created_at.slice(0, 10) : '',
  };
}

export const financeiroApi = {
  list: async (organizationId) => {
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data.map(receivableFromDb);
  },

  markAsPaid: async (id, paymentMethod) => {
    const { data, error } = await supabase
      .from('accounts_receivable')
      .update({ status: 'pago', paid_at: new Date().toISOString().slice(0, 10), payment_method: paymentMethod || null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return receivableFromDb(data);
  },
};
