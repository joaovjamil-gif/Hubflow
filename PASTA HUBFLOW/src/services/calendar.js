// src/services/calendar.js
//
// Agenda (`calendar_events`). Eventos originados de uma OS agendada são
// sincronizados automaticamente pelo banco (trigger
// sync_work_order_calendar_event, ver supabase/migrations/0019_...) — esta
// camada só cuida de eventos criados manualmente (reunião, lembrete, etc.)
// e da leitura por período.

import { supabase } from './supabaseClient.js';

function eventFromDb(row) {
  return {
    id: row.id,
    titulo: row.title,
    descricao: row.description || '',
    tipo: row.event_type,
    cliente_id: row.customer_id,
    orcamento_id: row.quote_id,
    ordem_servico_id: row.work_order_id,
    responsavel_id: row.responsible_id,
    inicio: row.starts_at,
    fim: row.ends_at,
    dia_inteiro: row.all_day,
    local: row.location || '',
    status: row.status,
    observacoes: row.notes || '',
    criado_em: row.created_at,
  };
}

export const agendaApi = {
  /** Lista eventos cujo início cai entre [startISO, endISO). */
  listRange: async (organizationId, startISO, endISO) => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('starts_at', startISO)
      .lt('starts_at', endISO)
      .order('starts_at', { ascending: true });
    if (error) throw error;
    return data.map(eventFromDb);
  },

  /** Evento manual (reunião, lembrete...) — nunca leva work_order_id, isso é exclusivo da sincronização automática. */
  create: async (organizationId, form) => {
    const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;
    const payload = {
      organization_id: organizationId,
      title: form.titulo,
      description: form.descricao || null,
      event_type: form.tipo || 'outro',
      customer_id: form.cliente_id || null,
      responsible_id: form.responsavel_id || null,
      starts_at: form.inicio,
      ends_at: form.fim || null,
      all_day: !!form.dia_inteiro,
      location: form.local || null,
      status: 'confirmado',
      notes: form.observacoes || null,
      created_by: userId,
    };
    const { data, error } = await supabase.from('calendar_events').insert(payload).select().single();
    if (error) throw error;
    return eventFromDb(data);
  },

  update: async (id, patch) => {
    const dbPatch = {};
    if (patch.titulo !== undefined) dbPatch.title = patch.titulo;
    if (patch.descricao !== undefined) dbPatch.description = patch.descricao || null;
    if (patch.inicio !== undefined) dbPatch.starts_at = patch.inicio;
    if (patch.fim !== undefined) dbPatch.ends_at = patch.fim || null;
    if (patch.local !== undefined) dbPatch.location = patch.local || null;
    if (patch.responsavel_id !== undefined) dbPatch.responsible_id = patch.responsavel_id || null;
    if (patch.cliente_id !== undefined) dbPatch.customer_id = patch.cliente_id || null;
    const { data, error } = await supabase.from('calendar_events').update(dbPatch).eq('id', id).select().single();
    if (error) throw error;
    return eventFromDb(data);
  },

  /** Só permitido para eventos manuais — um evento sincronizado de uma OS deve ser cancelado via a própria OS. */
  cancel: async (id) => {
    const { data, error } = await supabase.from('calendar_events').update({ status: 'cancelado' }).eq('id', id).select().single();
    if (error) throw error;
    return eventFromDb(data);
  },
};
