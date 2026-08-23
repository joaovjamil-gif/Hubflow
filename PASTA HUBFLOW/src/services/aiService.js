// src/services/aiService.js
//
// Único ponto de entrada do frontend para qualquer operação de IA. Nunca
// chama um provedor de IA diretamente — sempre via a Edge Function
// `ai-gateway` (ver supabase/functions/ai-gateway/index.ts), autenticada com
// a sessão do usuário. Isso é o que garante que nenhuma chave de provedor
// jamais precise existir no navegador: se um provedor for conectado no
// futuro, a chave fica só nas variáveis de ambiente da Edge Function.
//
// Estado atual: nenhum provedor está configurado. Toda chamada aqui é real
// (grava em ai_requests, autentica, respeita RLS) mas honestamente retorna
// status "not_configured" — este arquivo nunca inventa um texto de resposta.

import { supabase } from './supabaseClient.js';

/** Tipos de operação usados como `operation_type` nas chamadas — só rótulo/auditoria, o gateway trata todos igual até um provedor existir. */
export const AI_OPERATIONS = {
  QUOTE_DESCRIPTION: 'quote_description_suggestion',
  QUOTE_ITEMS_SUGGESTION: 'quote_items_suggestion',
  WORK_ORDER_CHECKLIST: 'work_order_checklist_suggestion',
  WORK_ORDER_SUMMARY: 'work_order_summary',
  CUSTOMER_SUMMARY: 'customer_summary',
  FINANCIAL_INSIGHT: 'financial_insight',
  ASSISTANT_QUERY: 'assistant_query',
};

export const aiService = {
  /**
   * Dispara uma solicitação de IA real via ai-gateway. `context` deve vir de
   * services/aiContext.js (nunca dados crus de outra organização). Retorna o
   * corpo da resposta do gateway tal qual — hoje sempre
   * `{ status: 'not_configured' | 'not_implemented', message?, request_id }`.
   */
  request: async (organizationId, operationType, { context, prompt } = {}) => {
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: { organization_id: organizationId, operation_type: operationType, context: context ?? null, prompt: prompt ?? null },
    });
    if (error) throw error;
    return data;
  },

  /** Histórico de solicitações de IA da organização — auditoria real, não IA fingida. */
  listRequests: async (organizationId, { limit = 20 } = {}) => {
    const { data, error } = await supabase
      .from('ai_requests')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      tipo: row.operation_type,
      status: row.status,
      erro: row.error,
      criadoEm: row.created_at,
      concluidoEm: row.completed_at,
    }));
  },
};
