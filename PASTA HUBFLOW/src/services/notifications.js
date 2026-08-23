// src/services/notifications.js
//
// Notificações internas (tabela `notifications`, ver
// supabase/migrations/0011_activity_logs_notifications.sql e
// 0023_notification_triggers.sql). São geradas automaticamente pelo banco
// (orçamento aprovado/recusado, OS atribuída/agendada/concluída, pagamento
// recebido/realizado, alertas diários de vencimento) — este arquivo só lê e
// marca como lida, nunca cria notificação diretamente pelo frontend.
//
// RLS: cada usuário só enxerga as próprias notificações (user_id = auth.uid()),
// então mesmo passando organizationId aqui o filtro real de segurança já
// está garantido pelo banco — o parâmetro só evita misturar notificações de
// organizações diferentes se o usuário pertencer a mais de uma no futuro.

import { supabase } from './supabaseClient.js';

function notificationFromDb(row) {
  return {
    id: row.id,
    titulo: row.title,
    mensagem: row.message || '',
    tipo: row.type,
    entidadeTipo: row.entity_type,
    entidadeId: row.entity_id,
    lida: row.is_read,
    lidaEm: row.read_at,
    criadoEm: row.created_at,
  };
}

export const notificationsApi = {
  list: async (organizationId, { limit = 30, onlyUnread = false } = {}) => {
    let query = supabase.from('notifications').select('*').eq('organization_id', organizationId);
    if (onlyUnread) query = query.eq('is_read', false);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data.map(notificationFromDb);
  },

  unreadCount: async (organizationId) => {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  },

  markRead: async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  markAllRead: async (organizationId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .eq('is_read', false);
    if (error) throw error;
  },

  /**
   * Assinatura opcional em tempo real (best effort: se a tabela não estiver na
   * publication do Realtime, o canal simplesmente nunca dispara — o polling
   * feito pelo componente que chama isso continua sendo a fonte confiável).
   * Retorna uma função de cleanup.
   */
  subscribe: (organizationId, onInsert) => {
    const channel = supabase
      .channel(`notifications-${organizationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `organization_id=eq.${organizationId}` },
        (payload) => onInsert(notificationFromDb(payload.new))
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

/** Rota da aplicação para onde clicar numa notificação deve levar, por entity_type. */
export function routeForNotification(entityType) {
  const map = {
    quotes: '/orcamentos',
    work_orders: '/ordens-servico',
    accounts_receivable: '/financeiro',
    accounts_payable: '/financeiro',
  };
  return map[entityType] || null;
}
