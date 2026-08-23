// src/services/api.js
//
// Camada de acesso a dados. TODA a interface (componentes/páginas) fala com
// este arquivo — nunca importa mockData diretamente. Isso é o que torna a
// troca Mock → Supabase uma mudança de UM arquivo, não de toda a aplicação.
//
// Cada função é assíncrona (retorna Promise) mesmo hoje sendo síncrona por
// baixo dos panos — assim o formato de chamada já é idêntico ao que será
// usado com o client real do Supabase (`await supabase.from(...).select()`).
//
// ⚠️ Estado em memória: os arrays abaixo são mutados diretamente nas funções
// create/update/delete. Isso simula persistência DURANTE a sessão, mas não
// sobrevive a um reload — não é banco de dados. Nenhuma função aqui promete
// mais do que isso.

import * as mock from '../data/mockData.js';

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

export const clientesApi = makeCrud(mock.clientes, 'c');
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
