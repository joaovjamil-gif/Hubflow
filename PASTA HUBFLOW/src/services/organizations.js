// src/services/organizations.js
//
// Acesso à tabela `organizations`. Hoje só é usada pela tela de
// Configurações (perfil do negócio). CRUD completo de organizações/convites
// de membros fica para quando existir uma UI de gestão multiempresa (ver
// docs/BACKEND.md).

import { supabase } from './supabaseClient.js';

export async function updateOrganization(id, patch) {
  const { data, error } = await supabase.from('organizations').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
