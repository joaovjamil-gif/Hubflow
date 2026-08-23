// src/services/payables.js
//
// Contas a pagar (`accounts_payable`). Ao marcar como pago, um trigger no
// banco gera automaticamente um lançamento em `transactions` (despesa) —
// ver supabase/migrations/0019_... — não é responsabilidade desta camada.

import { supabase } from './supabaseClient.js';

function payableFromDb(row) {
  return {
    id: row.id,
    fornecedor_id: row.supplier_id,
    descricao: row.description,
    categoria: row.category || '',
    valor: Number(row.amount) || 0,
    vencimento: row.due_date,
    pago_em: row.paid_at,
    status: row.status,
    forma_pagamento: row.payment_method || '',
    observacoes: row.notes || '',
    criado_em: row.created_at ? row.created_at.slice(0, 10) : '',
  };
}

export const contasPagarApi = {
  list: async (organizationId) => {
    const { data, error } = await supabase
      .from('accounts_payable')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data.map(payableFromDb);
  },
  create: async (organizationId, form) => {
    const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;
    const payload = {
      organization_id: organizationId,
      supplier_id: form.fornecedor_id || null,
      description: form.descricao,
      category: form.categoria || null,
      amount: Number(form.valor) || 0,
      due_date: form.vencimento,
      status: 'pendente',
      notes: form.observacoes || null,
      created_by: userId,
    };
    const { data, error } = await supabase.from('accounts_payable').insert(payload).select().single();
    if (error) throw error;
    return payableFromDb(data);
  },
  markAsPaid: async (id, paymentMethod) => {
    const { data, error } = await supabase
      .from('accounts_payable')
      .update({ status: 'pago', paid_at: new Date().toISOString().slice(0, 10), payment_method: paymentMethod || null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return payableFromDb(data);
  },
  cancel: async (id) => {
    const { data, error } = await supabase.from('accounts_payable').update({ status: 'cancelado' }).eq('id', id).select().single();
    if (error) throw error;
    return payableFromDb(data);
  },
};
