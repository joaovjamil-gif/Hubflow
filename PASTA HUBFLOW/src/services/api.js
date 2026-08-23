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
import { quotesApi } from './quotes.js';
import { workOrdersApi } from './workOrders.js';
import { financeiroApi as financialApi } from './financial.js';
import { catalogoApi as catalogService } from './catalog.js';
import { fornecedoresApi as suppliersService } from './suppliers.js';
import { contasPagarApi as payablesService } from './payables.js';
import { agendaApi as calendarService } from './calendar.js';

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
  status: 'status',
  documento: 'document',
  tipo: 'customer_type',
};

function customerFromDb(row) {
  return {
    id: row.id,
    nome: row.name,
    telefone: row.phone || '',
    email: row.email || '',
    endereco: row.address || '',
    observacoes: row.notes || '',
    status: row.status,
    documento: row.document || '',
    tipo: row.customer_type,
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
  // (slice(-3).reverse()). Passar {search, status} não muda a ordem.
  list: async ({ search = '', status = '' } = {}) => {
    let query = supabase
      .from('customers')
      .select('*')
      .eq('organization_id', requireOrganizationId())
      .is('deleted_at', null);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`name.ilike.%${search}%,document.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await query.order('created_at', { ascending: true });
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

// --- Contatos do cliente (customer_contacts) ----------------------------
function contactFromDb(row) {
  return {
    id: row.id,
    nome: row.name,
    funcao: row.role || '',
    email: row.email || '',
    telefone: row.phone || '',
    whatsapp: row.whatsapp || '',
    principal: row.is_primary,
    observacoes: row.notes || '',
  };
}

export const contatosClienteApi = {
  list: async (customerId) => {
    const { data, error } = await supabase.from('customer_contacts').select('*').eq('customer_id', customerId).order('is_primary', { ascending: false });
    if (error) throw error;
    return data.map(contactFromDb);
  },
  create: async (customerId, form) => {
    const { data, error } = await supabase
      .from('customer_contacts')
      .insert({
        customer_id: customerId,
        name: form.nome,
        role: form.funcao || null,
        email: form.email || null,
        phone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        is_primary: !!form.principal,
        notes: form.observacoes || null,
      })
      .select()
      .single();
    if (error) throw error;
    return contactFromDb(data);
  },
  remove: async (id) => {
    const { error } = await supabase.from('customer_contacts').delete().eq('id', id);
    if (error) throw error;
  },
};

/** Documentos já anexados a uma entidade (leitura — upload ainda pendente, ver docs/BACKEND.md). */
export async function listDocumentosDaEntidade(entityType, entityId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export const documentosApi = makeCrud(mock.documentos, 'd');

// --- Catálogo de serviços, fornecedores, contas a pagar, agenda ---------
export const catalogoApi = {
  list: (opts) => catalogService.list(requireOrganizationId(), opts),
  create: (form) => catalogService.create(requireOrganizationId(), form),
  update: (id, patch) => catalogService.update(id, patch),
  setActive: (id, ativo) => catalogService.setActive(id, ativo),
};

export const fornecedoresApi = {
  list: (opts) => suppliersService.list(requireOrganizationId(), opts),
  get: (id) => suppliersService.get(id),
  create: (form) => suppliersService.create(requireOrganizationId(), form),
  update: (id, patch) => suppliersService.update(id, patch),
};

export const contasPagarApi = {
  list: () => payablesService.list(requireOrganizationId()),
  create: (form) => payablesService.create(requireOrganizationId(), form),
  markAsPaid: (id, paymentMethod) => payablesService.markAsPaid(id, paymentMethod),
  cancel: (id) => payablesService.cancel(id),
};

export const agendaCompletaApi = {
  listRange: (startISO, endISO) => calendarService.listRange(requireOrganizationId(), startISO, endISO),
  create: (form) => calendarService.create(requireOrganizationId(), form),
  update: (id, patch) => calendarService.update(id, patch),
  cancel: (id) => calendarService.cancel(id),
};

// --- Núcleo operacional (orçamentos, OS, financeiro) — conectado ao Supabase ---
//
// Cliente → Orçamento → Aprovação → OS → Financeiro. A partir daqui nada é
// mock: números, totais, transições de status e a geração automática de OS
// e de lançamento financeiro são responsabilidade do banco (funções e
// triggers em supabase/migrations/0014_ e 0015_), não desta camada — aqui
// só traduzimos formato e chamamos as funções certas.

export const orcamentosApi = {
  list: () => quotesApi.list(requireOrganizationId()),
  get: (id) => quotesApi.get(id),
  listItems: (quoteId) => quotesApi.listItems(quoteId),
  /** form: {cliente_id, titulo, descricao, validade, desconto, impostos, observacoes, condicoes_pagamento}; items: [{descricao, quantidade, unidade, preco_unitario, desconto}] */
  create: (form, items) => quotesApi.create(requireOrganizationId(), form, items),
  updateStatus: (id, status) => quotesApi.updateStatus(id, status),
};

export const ordensServicoApi = {
  list: () => workOrdersApi.list(requireOrganizationId()),
  get: (id) => workOrdersApi.get(id),
  listItems: (workOrderId) => workOrdersApi.listItems(workOrderId),
  addItem: (workOrderId, item) => workOrdersApi.addItem(workOrderId, item),
  /** form: {cliente_id, titulo, descricao, prioridade, data_prevista, hora_prevista, endereco, valor_estimado, responsavel_id}; items: [{descricao, quantidade, preco_unitario}] */
  create: (form, items) => workOrdersApi.create(requireOrganizationId(), form, items),
  updateStatus: (id, status, extra) => workOrdersApi.updateStatus(id, status, extra),
  listChecklist: (workOrderId) => workOrdersApi.listChecklist(workOrderId),
  addChecklistItem: (workOrderId, descricao) => workOrdersApi.addChecklistItem(workOrderId, descricao),
  toggleChecklistItem: (id, feito) => workOrdersApi.toggleChecklistItem(id, feito),
  removeChecklistItem: (id) => workOrdersApi.removeChecklistItem(id),
  listTeam: (workOrderId) => workOrdersApi.listTeam(workOrderId),
  addTeamMember: (workOrderId, userId, funcao) => workOrdersApi.addTeamMember(workOrderId, userId, funcao),
  removeTeamMember: (id) => workOrdersApi.removeTeamMember(id),
};

export const financeiroApi = {
  list: () => financialApi.list(requireOrganizationId()),
  markAsPaid: (id, paymentMethod) => financialApi.markAsPaid(id, paymentMethod),
};

// --- Regras de negócio que atravessam módulos (o "fluxo" prometido na landing) ---

/** Orçamento aprovado → gera Ordem de Serviço pré-preenchida, sem redigitação (RPC atômica no banco). */
export async function aprovarOrcamentoEGerarOS(orcamentoId) {
  return quotesApi.approve(orcamentoId);
}

/** OS concluída → gera lançamento financeiro pendente automaticamente (RPC atômica no banco). */
export async function concluirOSEGerarLancamento(osId, { valorFinal, vencimento, formaPagamento } = {}) {
  return workOrdersApi.complete(osId, { valorFinal, vencimento, formaPagamento });
}

/** Agenda não duplica dados: é derivada diretamente das OS com data/horário definidos. */
export async function listAgendaDoDia(data) {
  const todas = await workOrdersApi.list(requireOrganizationId());
  return todas
    .filter((os) => os.data === data && os.horario)
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

export async function getResumoDashboard() {
  const orgId = requireOrganizationId();
  const [clientes, orcs, oss, receber, pagar] = await Promise.all([
    clientesApi.list(),
    quotesApi.list(orgId),
    workOrdersApi.list(orgId),
    financialApi.list(orgId),
    payablesService.list(orgId),
  ]);
  const hoje = new Date().toISOString().slice(0, 10);
  const estaAtrasado = (f) => f.status === 'atrasado' || (f.status === 'pendente' && f.vencimento && f.vencimento < hoje);

  const orcamentosAprovados = orcs.filter((o) => o.status === 'aprovado').length;
  const osComOrigemEmOrcamento = oss.filter((os) => os.orcamento_id).length;

  return {
    // já existiam, mantidos para compatibilidade com quem já usa
    aReceber: receber.filter((f) => f.status !== 'pago').reduce((s, f) => s + f.valor, 0),
    orcamentosPendentes: orcs.filter((o) => ['enviado', 'visualizado'].includes(o.status)).length,
    servicosHoje: oss.filter((os) => os.data === hoje).length,
    pagamentosAtrasados: receber.filter(estaAtrasado).length,

    // indicadores novos, todos calculados a partir do banco
    clientesAtivos: clientes.filter((c) => c.status === 'active' || !c.status).length,
    orcamentosAprovados,
    conversaoOrcamentoParaOS: orcamentosAprovados > 0 ? Math.round((osComOrigemEmOrcamento / orcamentosAprovados) * 100) : 0,
    osEmAndamento: oss.filter((os) => os.status === 'em_andamento').length,
    osAtrasadas: oss.filter((os) => os.data && os.data < hoje && !['concluida', 'cancelada'].includes(os.status)).length,
    receitaPrevista: receber.filter((f) => f.status !== 'pago' && f.status !== 'cancelado').reduce((s, f) => s + f.valor, 0),
    receitaRecebida: receber.filter((f) => f.status === 'pago').reduce((s, f) => s + f.valor, 0),
    despesasPendentes: pagar.filter((p) => p.status !== 'pago' && p.status !== 'cancelado').reduce((s, p) => s + p.valor, 0),
    despesasPagas: pagar.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0),
    contasVencidas: receber.filter(estaAtrasado).length + pagar.filter((p) => p.status === 'pendente' && p.vencimento && p.vencimento < hoje).length,
    fluxoLiquido:
      receber.filter((f) => f.status === 'pago').reduce((s, f) => s + f.valor, 0) -
      pagar.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0),
  };
}

export const statusLabels = {
  orcamento: {
    rascunho: 'Rascunho',
    enviado: 'Enviado',
    visualizado: 'Visualizado',
    aprovado: 'Aprovado',
    recusado: 'Recusado',
    expirado: 'Expirado',
    cancelado: 'Cancelado',
  },
  os: {
    aberta: 'Aberta',
    agendada: 'Agendada',
    em_andamento: 'Em andamento',
    aguardando: 'Aguardando',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  },
  financeiro: {
    pendente: 'Pendente',
    pago: 'Pago',
    atrasado: 'Atrasado',
    cancelado: 'Cancelado',
  },
  fornecedor: {
    active: 'Ativo',
    inactive: 'Inativo',
  },
  agenda: {
    confirmado: 'Confirmado',
    pendente: 'Pendente',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  },
};
