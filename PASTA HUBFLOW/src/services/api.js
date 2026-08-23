// src/services/api.js
//
// Camada de acesso a dados. TODA a interface (componentes/páginas) fala com
// este arquivo — nunca importa mockData diretamente. Isso é o que torna a
// troca Mock → Supabase uma mudança de UM arquivo, não de toda a aplicação.
//
// Cada função é assíncrona (retorna Promise) mesmo hoje sendo síncrona por
// baixo dos panos, para as entidades que ainda usam mock — assim o formato
// de chamada já é idêntico ao que é usado com o client real do Supabase.
//
// ⚠️ Estado em memória (só para o que ainda é mock): os arrays abaixo são
// mutados diretamente nas funções create/update/delete. Isso simula
// persistência DURANTE a sessão, mas não sobrevive a um reload — não é
// banco de dados. `clientesApi` já não é mock — ver abaixo.

import * as mock from '../data/mockData.js';
import { supabase } from './supabaseClient.js';

const delay = (ms = 120) => new Promise((res) => setTimeout(res, ms));
const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

function makeCrud(store, prefix) {
  return {
    list: async () => { await delay(); return [...store]; },
    get: async (id) => { await delay(); return store.find((r) => r.id === id) || null; },
    create: async (data) => {
      await delay();
      const record = { id: uid(prefix), criado_em: new Date().toISOString().slice(0, 10), ...data };
      store.push(record);
      return record;
    },
    update: async (id, patch) => {
      await delay();
      const idx = store.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`${prefix} ${id} não encontrado`);
      store[idx] = { ...store[idx], ...patch };
      return store[idx];
    },
    remove: async (id) => {
      await delay();
      const idx = store.findIndex((r) => r.id === id);
      if (idx === -1) return false;
      store.splice(idx, 1);
      return true;
    },
  };
}

// --- Organização atual (multi-tenant) ---------------------------------
//
// Definida uma vez pelo App.js assim que a sessão autentica (ver
// src/App.js, useAuth -> getOrEnsureOrganization). Todas as funções que já
// falam com o Supabase abaixo dependem disso para respeitar o isolamento
// por organização — o RLS no banco é a proteção real, isto aqui é só para
// as queries já saírem filtradas.
let currentOrganizationId = null;

export function setCurrentOrganizationId(id) {
  currentOrganizationId = id || null;
}

function requireOrganizationId() {
  if (!currentOrganizationId) {
    throw new Error('Nenhuma organização carregada ainda — tente novamente em instantes.');
  }
  return currentOrganizationId;
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// --- Clientes (customers) — conectado ao Supabase ----------------------
//
// A tabela real (`customers`, ver supabase/migrations/0003_customers.sql)
// usa nomes de campo em inglês; a interface já foi construída em torno dos
// nomes em português do mock original (nome/telefone/endereco/...). Para
// não precisar tocar em nenhuma página, o mapeamento abaixo traduz nos dois
// sentidos — esta é a única parte do código que conhece os dois formatos.
const CUSTOMER_FIELD_MAP = {
  nome: 'name',
  telefone: 'phone',
  email: 'email',
  endereco: 'address',
  observacoes: 'notes',
};

function customerFromDb(row) {
  return {
    id: row.id,
    nome: row.name,
    telefone: row.phone || '',
    email: row.email || '',
    endereco: row.address || '',
    observacoes: row.notes || '',
    criado_em: row.created_at ? row.created_at.slice(0, 10) : '',
  };
}

function customerToDb(partial) {
  const out = {};
  for (const [feKey, dbKey] of Object.entries(CUSTOMER_FIELD_MAP)) {
    if (partial[feKey] !== undefined) out[dbKey] = partial[feKey] || null;
  }
  return out;
}

export const clientesApi = {
  // Ordem ascendente por criação (mais antigo → mais novo), igual ao mock
  // original — dashboard.js depende disso para "clientes recentes"
  // (slice(-3).reverse()).
  list: async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('organization_id', requireOrganizationId())
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(customerFromDb);
  },
  get: async (id) => {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? customerFromDb(data) : null;
  },
  create: async (formData) => {
    const userId = await currentUserId();
    const payload = { ...customerToDb(formData), organization_id: requireOrganizationId(), created_by: userId, updated_by: userId };
    const { data, error } = await supabase.from('customers').insert(payload).select().single();
    if (error) throw error;
    return customerFromDb(data);
  },
  update: async (id, patch) => {
    const userId = await currentUserId();
    const payload = { ...customerToDb(patch), updated_by: userId };
    const { data, error } = await supabase.from('customers').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return customerFromDb(data);
  },
  // Soft delete: mantém o histórico (rule 18) em vez de apagar de vez.
  remove: async (id) => {
    const userId = await currentUserId();
    const { error } = await supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq('id', id);
    if (error) throw error;
    return true;
  },
};

export const orcamentosApi = makeCrud(mock.orcamentos, 'o');
export const ordensServicoApi = makeCrud(mock.ordensServico, 'os');
export const financeiroApi = makeCrud(mock.financeiroLancamentos, 'f');
export const documentosApi = makeCrud(mock.documentos, 'd');

// --- Regras de negócio que atravessam módulos (o "fluxo" prometido na landing) ---

/** Orçamento aprovado → gera Ordem de Serviço pré-preenchida, sem redigitação. */
export async function aprovarOrcamentoEGerarOS(orcamentoId) {
  const orc = await orcamentosApi.update(orcamentoId, { status: 'aprovado' });
  const os = await ordensServicoApi.create({
    cliente_id: orc.cliente_id,
    orcamento_id: orc.id,
    numero: `OS ${orc.numero}`,
    servico: orc.descricao,
    descricao: orc.descricao,
    responsavel: 'A definir',
    data: null,
    horario: null,
    endereco: '',
    materiais: [],
    mao_de_obra: 0,
    valor: orc.valor_total,
    status: 'aberta',
  });
  return { orcamento: orc, ordemServico: os };
}

/** OS concluída com valor → gera lançamento financeiro pendente automaticamente. */
export async function concluirOSEGerarLancamento(osId, vencimento) {
  const os = await ordensServicoApi.update(osId, { status: 'concluida' });
  if (os.valor > 0) {
    await financeiroApi.create({
      tipo: 'receita',
      cliente_id: os.cliente_id,
      ordem_servico_id: os.id,
      orcamento_id: os.orcamento_id,
      valor: os.valor,
      status: 'pendente',
      vencimento: vencimento || null,
      pago_em: null,
    });
  }
  return os;
}

/** Agenda não duplica dados: é derivada diretamente das OS com data/horário definidos. */
export async function listAgendaDoDia(data) {
  const todas = await ordensServicoApi.list();
  return todas
    .filter((os) => os.data === data && os.horario)
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

export async function getResumoDashboard() {
  const [orcs, oss, fin] = await Promise.all([orcamentosApi.list(), ordensServicoApi.list(), financeiroApi.list()]);
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    aReceber: fin.filter((f) => f.status !== 'pago').reduce((s, f) => s + f.valor, 0),
    orcamentosPendentes: orcs.filter((o) => ['enviado', 'aguardando', 'visualizado'].includes(o.status)).length,
    servicosHoje: oss.filter((os) => os.data === hoje || os.data === '2026-08-22').length,
    pagamentosAtrasados: fin.filter((f) => f.status === 'atrasado').length,
  };
}

export { statusLabels } from '../data/mockData.js';
