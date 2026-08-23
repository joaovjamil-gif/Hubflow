// src/data/mockData.js
//
// ⚠️ DADOS MOCK — não é banco de dados real.
// Formato idêntico ao schema definido em docs/ARQUITETURA.md, para que a troca
// futura por Supabase exija apenas trocar a implementação de src/services/api.js,
// sem tocar em componentes ou páginas.
//
// Estado vive em memória: recarregar a página reseta tudo. Isso é intencional —
// não fingimos persistência que não existe neste ambiente.

export const clientes = [
  { id: 'c1', nome: 'Maria Silva', telefone: '(11) 99999-1234', email: 'maria.silva@email.com', endereco: 'Rua das Flores, 120 — São Paulo/SP', observacoes: 'Cliente desde 2024. Prefere contato por WhatsApp.', criado_em: '2026-02-10' },
  { id: 'c2', nome: 'João Pereira', telefone: '(21) 98888-5678', email: 'joao.pereira@email.com', endereco: 'Av. Brasil, 450 — Rio de Janeiro/RJ', observacoes: '', criado_em: '2026-03-22' },
  { id: 'c3', nome: 'Ana Costa', telefone: '(31) 97777-4321', email: 'ana.costa@email.com', endereco: 'Rua Minas, 88 — Belo Horizonte/MG', observacoes: 'Prédio comercial, agendar entrada pela portaria.', criado_em: '2026-05-02' },
  { id: 'c4', nome: 'Carlos Souza', telefone: '(41) 96666-1122', email: 'carlos.souza@email.com', endereco: 'Rua Paraná, 33 — Curitiba/PR', observacoes: '', criado_em: '2026-06-14' },
];

export const orcamentos = [
  { id: 'o1', cliente_id: 'c1', numero: '#042', data: '2026-08-18', validade: '2026-09-01', descricao: 'Instalação elétrica completa — sala e cozinha', itens: [{ descricao: 'Instalação de tomadas', qtd: 6, preco: 45 }, { descricao: 'Disjuntor 20A', qtd: 2, preco: 45 }], desconto: 0, valor_total: 360, status: 'aprovado', criado_em: '2026-08-18' },
  { id: 'o2', cliente_id: 'c2', numero: '#041', data: '2026-08-17', validade: '2026-08-31', descricao: 'Manutenção preventiva de painel elétrico', itens: [{ descricao: 'Visita técnica + revisão', qtd: 1, preco: 220 }], desconto: 20, valor_total: 200, status: 'enviado', criado_em: '2026-08-17' },
  { id: 'o3', cliente_id: 'c3', numero: '#040', data: '2026-08-15', validade: '2026-08-29', descricao: 'Visita técnica para diagnóstico', itens: [{ descricao: 'Diagnóstico', qtd: 1, preco: 120 }], desconto: 0, valor_total: 120, status: 'rascunho', criado_em: '2026-08-15' },
  { id: 'o4', cliente_id: 'c4', numero: '#039', data: '2026-08-10', validade: '2026-08-24', descricao: 'Troca de disjuntor geral', itens: [{ descricao: 'Disjuntor 40A', qtd: 1, preco: 90 }, { descricao: 'Mão de obra', qtd: 1, preco: 130 }], desconto: 0, valor_total: 220, status: 'aguardando', criado_em: '2026-08-10' },
];

export const ordensServico = [
  { id: 'os1', cliente_id: 'c1', orcamento_id: 'o1', numero: 'OS #042', servico: 'Instalação elétrica', descricao: 'Instalação completa conforme orçamento #042', responsavel: 'Equipe própria', data: '2026-08-22', horario: '09:00', endereco: 'Rua das Flores, 120', materiais: ['Disjuntor 20A x2', 'Tomadas x6'], mao_de_obra: 180, valor: 360, status: 'agendada' },
  { id: 'os2', cliente_id: 'c2', orcamento_id: null, numero: 'OS #043', servico: 'Manutenção preventiva', descricao: 'Revisão geral do painel', responsavel: 'Equipe própria', data: '2026-08-22', horario: '13:30', endereco: 'Av. Brasil, 450', materiais: [], mao_de_obra: 220, valor: 220, status: 'em_andamento' },
  { id: 'os3', cliente_id: 'c3', orcamento_id: null, numero: 'OS #044', servico: 'Visita técnica', descricao: 'Diagnóstico de instalação', responsavel: 'Equipe própria', data: '2026-08-22', horario: '16:00', endereco: 'Rua Minas, 88', materiais: [], mao_de_obra: 0, valor: 0, status: 'aberta' },
];

export const financeiroLancamentos = [
  { id: 'f1', tipo: 'receita', cliente_id: 'c4', ordem_servico_id: null, orcamento_id: 'o4', valor: 220, status: 'pendente', vencimento: '2026-08-27', pago_em: null },
  { id: 'f2', tipo: 'receita', cliente_id: 'c1', ordem_servico_id: 'os1', orcamento_id: 'o1', valor: 360, status: 'pendente', vencimento: '2026-08-25', pago_em: null },
  { id: 'f3', tipo: 'receita', cliente_id: 'c2', ordem_servico_id: null, orcamento_id: null, valor: 320, status: 'pago', vencimento: '2026-08-05', pago_em: '2026-08-05' },
  { id: 'f4', tipo: 'receita', cliente_id: 'c3', ordem_servico_id: null, orcamento_id: null, valor: 220, status: 'atrasado', vencimento: '2026-08-12', pago_em: null },
];

export const documentos = [
  // Vazio por padrão: upload real de arquivo exige storage de backend (Supabase Storage),
  // que ainda não está conectado neste ambiente.
];

export const statusLabels = {
  orcamento: { rascunho: 'Rascunho', enviado: 'Enviado', visualizado: 'Visualizado', aprovado: 'Aprovado', recusado: 'Recusado', expirado: 'Expirado', aguardando: 'Aguardando' },
  os: { aberta: 'Aberta', agendada: 'Agendada', em_andamento: 'Em andamento', aguardando: 'Aguardando', concluida: 'Concluída', cancelada: 'Cancelada' },
  financeiro: { pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado' },
};
