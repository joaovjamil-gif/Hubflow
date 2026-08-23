// src/services/aiContext.js
//
// Monta o `context` (jsonb) enviado ao ai-gateway a partir de dados já
// carregados pela página — nunca busca dado extra nem de outra organização.
// Cada builder devolve só o necessário para a operação, evitando mandar
// registros inteiros (e todos os campos internos/sensíveis) para um futuro
// provedor externo.

export function buildQuoteContext(quote, items = []) {
  return {
    titulo: quote.titulo || quote.descricao || '',
    descricao: quote.descricao || '',
    itens: items.map((it) => ({ descricao: it.descricao, quantidade: it.quantidade, preco_unitario: it.preco_unitario })),
    valor_total: quote.valor_total,
  };
}

export function buildWorkOrderContext(workOrder, items = [], checklist = []) {
  return {
    titulo: workOrder.titulo || workOrder.descricao || '',
    descricao: workOrder.descricao || '',
    prioridade: workOrder.prioridade,
    itens: items.map((it) => ({ descricao: it.descricao, quantidade: it.quantidade })),
    checklist_atual: checklist.map((c) => c.descricao),
  };
}

export function buildCustomerContext(customer, { quotesCount = 0, workOrdersCount = 0 } = {}) {
  return {
    nome: customer.nome,
    status: customer.status,
    total_orcamentos: quotesCount,
    total_os: workOrdersCount,
  };
}

export function buildFinancialContext({ aReceber = 0, aPagar = 0, vencidoReceber = 0, vencidoPagar = 0 } = {}) {
  return { a_receber: aReceber, a_pagar: aPagar, vencido_receber: vencidoReceber, vencido_pagar: vencidoPagar };
}
