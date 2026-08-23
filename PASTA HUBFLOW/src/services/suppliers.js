// src/services/suppliers.js
//
// Fornecedores (`suppliers`), com histórico automático (activity_logs) já
// ligado via trigger (ver supabase/migrations/0019_...). Relacionamento
// com contas a pagar é por supplier_id em accounts_payable.

import { supabase } from './supabaseClient.js';

function supplierFromDb(row) {
  return {
    id: row.id,
    nome: row.name,
    razao_social: row.legal_name || '',
    documento: row.document || '',
    email: row.email || '',
    telefone: row.phone || '',
    endereco: row.address || '',
    categoria: row.category || '',
    observacoes: row.notes || '',
    status: row.status,
    criado_em: row.created_at ? row.created_at.slice(0, 10) : '',
  };
}

function supplierToDb(partial) {
  const map = {
    nome: 'name',
    razao_social: 'legal_name',
    documento: 'document',
    email: 'email',
    telefone: 'phone',
    endereco: 'address',
    categoria: 'category',
    observacoes: 'notes',
    status: 'status',
  };
  const out = {};
  for (const [feKey, dbKey] of Object.entries(map)) {
    if (partial[feKey] !== undefined) out[dbKey] = partial[feKey] === '' ? null : partial[feKey];
  }
  return out;
}

export const fornecedoresApi = {
  list: async (organizationId, { search = '' } = {}) => {
    let query = supabase.from('suppliers').select('*').eq('organization_id', organizationId).is('deleted_at', null);
    if (search) query = query.or(`name.ilike.%${search}%,document.ilike.%${search}%`);
    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;
    return data.map(supplierFromDb);
  },
  get: async (id) => {
    const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? supplierFromDb(data) : null;
  },
  create: async (organizationId, form) => {
    const payload = { ...supplierToDb(form), organization_id: organizationId };
    const { data, error } = await supabase.from('suppliers').insert(payload).select().single();
    if (error) throw error;
    return supplierFromDb(data);
  },
  update: async (id, patch) => {
    const { data, error } = await supabase.from('suppliers').update(supplierToDb(patch)).eq('id', id).select().single();
    if (error) throw error;
    return supplierFromDb(data);
  },
};
