// src/services/catalog.js
//
// Catálogo de serviços/produtos (`services`). Conectado a Orçamentos e OS:
// ao escolher um item do catálogo, description/unit_price são copiados
// para a linha do orçamento/OS (quote_items.service_id /
// work_order_items.service_id) — o histórico nunca muda retroativamente
// se o preço do catálogo for editado depois, porque o valor já foi
// congelado na linha no momento da escolha.

import { supabase } from './supabaseClient.js';

function serviceFromDb(row) {
  return {
    id: row.id,
    nome: row.name,
    descricao: row.description || '',
    categoria: row.category || '',
    codigo: row.internal_code || '',
    preco_padrao: Number(row.default_price) || 0,
    unidade: row.unit || 'un',
    duracao_estimada: row.estimated_duration_minutes,
    custo: row.cost === null ? null : Number(row.cost),
    margem: row.margin === null ? null : Number(row.margin),
    tipo: row.item_type,
    ativo: row.is_active,
    criado_em: row.created_at ? row.created_at.slice(0, 10) : '',
  };
}

function serviceToDb(partial) {
  const map = {
    nome: 'name',
    descricao: 'description',
    categoria: 'category',
    codigo: 'internal_code',
    preco_padrao: 'default_price',
    unidade: 'unit',
    duracao_estimada: 'estimated_duration_minutes',
    custo: 'cost',
    margem: 'margin',
    tipo: 'item_type',
    ativo: 'is_active',
  };
  const out = {};
  for (const [feKey, dbKey] of Object.entries(map)) {
    if (partial[feKey] !== undefined) out[dbKey] = partial[feKey] === '' ? null : partial[feKey];
  }
  return out;
}

export const catalogoApi = {
  list: async (organizationId, { search = '', onlyActive = false } = {}) => {
    let query = supabase.from('services').select('*').eq('organization_id', organizationId);
    if (onlyActive) query = query.eq('is_active', true);
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;
    return data.map(serviceFromDb);
  },
  create: async (organizationId, form) => {
    const payload = { ...serviceToDb(form), organization_id: organizationId };
    const { data, error } = await supabase.from('services').insert(payload).select().single();
    if (error) throw error;
    return serviceFromDb(data);
  },
  update: async (id, patch) => {
    const { data, error } = await supabase.from('services').update(serviceToDb(patch)).eq('id', id).select().single();
    if (error) throw error;
    return serviceFromDb(data);
  },
  setActive: async (id, ativo) => {
    const { data, error } = await supabase.from('services').update({ is_active: ativo }).eq('id', id).select().single();
    if (error) throw error;
    return serviceFromDb(data);
  },
};
