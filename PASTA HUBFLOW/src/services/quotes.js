// src/services/quotes.js
//
// Orçamentos (quotes) — conectado ao Supabase. Substitui o mock antigo de
// orcamentosApi. Totais/subtotais NÃO são calculados aqui: o banco
// recalcula sempre a partir dos itens reais (ver trigger
// recompute_quote_totals em supabase/migrations/0014_...), então o valor
// que volta do banco depois de criar/editar itens é sempre a fonte da
// verdade — nunca confiamos num total calculado só no cliente.

import { supabase } from './supabaseClient.js';

function quoteFromDb(row) {
  return {
    id: row.id,
    cliente_id: row.customer_id,
    responsavel_id: row.responsible_id,
    numero: row.number,
    titulo: row.title,
    descricao: row.description,
    status: row.status,
    validade: row.valid_until,
    subtotal: Number(row.subtotal) || 0,
    desconto: Number(row.discount) || 0,
    impostos: Number(row.taxes) || 0,
    valor_total: Number(row.total_amount) || 0,
    observacoes: row.notes,
    condicoes_pagamento: row.payment_terms,
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
    unidade: row.unit,
    preco_unitario: Number(row.unit_price) || 0,
    desconto: Number(row.discount) || 0,
    subtotal: Number(row.subtotal) || 0,
  };
}

export const quotesApi = {
  list: async (organizationId) => {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(quoteFromDb);
  },

  get: async (id) => {
    const { data, error } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? quoteFromDb(data) : null;
  },

  listItems: async (quoteId) => {
    const { data, error } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(itemFromDb);
  },

  /**
   * Cria o orçamento e todos os itens numa transação só (RPC create_quote).
   * `items`: [{ descricao, quantidade, unidade, preco_unitario, desconto }]
   */
  create: async (organizationId, form, items) => {
    const { data, error } = await supabase.rpc('create_quote', {
      p_organization_id: organizationId,
      p_customer_id: form.cliente_id,
      p_title: form.titulo || null,
      p_description: form.descricao || null,
      p_valid_until: form.validade || null,
      p_discount: Number(form.desconto) || 0,
      p_taxes: Number(form.impostos) || 0,
      p_notes: form.observacoes || null,
      p_payment_terms: form.condicoes_pagamento || null,
      p_items: (items || []).map((it) => ({
        service_id: it.servico_id || undefined,
        description: it.descricao,
        quantity: Number(it.quantidade) || 1,
        unit: it.unidade || 'un',
        unit_price: Number(it.preco_unitario) || 0,
        discount: Number(it.desconto) || 0,
      })),
    });
    if (error) throw error;
    return quoteFromDb(data);
  },

  /** Transições simples de status (rascunho->enviado, ->recusado, ->cancelado, ...). O banco valida se é permitida. */
  updateStatus: async (id, status) => {
    const { data, error } = await supabase.from('quotes').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return quoteFromDb(data);
  },

  /** Aprova o orçamento e gera a OS automaticamente (RPC atômica). */
  approve: async (id) => {
    const { data, error } = await supabase.rpc('approve_quote', { p_quote_id: id });
    if (error) throw error;
    return {
      orcamento: quoteFromDb(data.quote),
      ordemServico: {
        id: data.work_order.id,
        numero: data.work_order.number,
      },
    };
  },
};
