// src/services/activity.js
//
// Leitura do histórico gerado automaticamente pelos triggers de banco
// (log_entity_activity, ver supabase/migrations/0014_...). Nenhuma página
// escreve em activity_logs diretamente — é sempre o banco que registra.

import { supabase } from './supabaseClient.js';

const ACTION_LABELS = {
  create: 'Criado',
  update: 'Atualizado',
  delete: 'Excluído',
  approve: 'Aprovado',
  reject: 'Recusado',
  complete: 'Concluído',
  cancel: 'Cancelado',
  other: 'Alterado',
};

export async function listActivity(entityType, entityId) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    acao: ACTION_LABELS[row.action] || row.action,
    descricao: row.description,
    quando: row.created_at,
  }));
}

const ENTITY_LABELS = {
  customers: 'Cliente',
  quotes: 'Orçamento',
  work_orders: 'Ordem de serviço',
  accounts_receivable: 'Conta a receber',
  accounts_payable: 'Conta a pagar',
  suppliers: 'Fornecedor',
};

/** Feed de atividade de toda a organização (dashboard) — mesma tabela, sem filtrar por uma entidade só. */
export async function listRecentActivity(organizationId, limit = 12) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    acao: ACTION_LABELS[row.action] || row.action,
    entidade: ENTITY_LABELS[row.entity_type] || row.entity_type,
    descricao: row.description,
    quando: row.created_at,
  }));
}
