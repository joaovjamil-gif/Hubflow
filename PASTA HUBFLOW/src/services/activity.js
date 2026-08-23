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
