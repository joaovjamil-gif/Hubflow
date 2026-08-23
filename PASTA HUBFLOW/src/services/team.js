// src/services/team.js
//
// Membros da organização atual, para o seletor de "responsável" em Ordens
// de Serviço. Não há UI de convite/gestão de membros ainda (ver
// docs/BACKEND.md) — isto só lista quem já é membro.

import { supabase } from './supabaseClient.js';

export async function listOrganizationMembers(organizationId) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, role, profiles(id, full_name, email)')
    .eq('organization_id', organizationId)
    .eq('status', 'active');
  if (error) throw error;
  return data.map((m) => ({
    id: m.user_id,
    nome: m.profiles?.full_name || m.profiles?.email || 'Sem nome',
    role: m.role,
  }));
}
