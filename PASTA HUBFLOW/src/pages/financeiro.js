// src/pages/financeiro.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, StatCard, Table, Badge, statusTone, EmptyState, Button } from '../components/ui.js';
import { financeiroApi, clientesApi, statusLabels } from '../services/api.js';

function statusEfetivo(lancamento, hoje) {
  if (lancamento.status === 'pendente' && lancamento.vencimento && lancamento.vencimento < hoje) return 'atrasado';
  return lancamento.status;
}

export function FinanceiroPage() {
  const [lancamentos, setLancamentos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState(null);
  const [erro, setErro] = React.useState('');

  function reload() {
    setLoading(true);
    Promise.all([financeiroApi.list(), clientesApi.list()])
      .then(([f, c]) => { setLancamentos(f); setClientes(c); })
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, []);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '—';
  const hoje = new Date().toISOString().slice(0, 10);

  const soma = (pred) => lancamentos.filter(pred).reduce((s, l) => s + l.valor, 0);
  const aReceber = soma((l) => statusEfetivo(l, hoje) === 'pendente' || statusEfetivo(l, hoje) === 'atrasado');
  const recebido = soma((l) => l.status === 'pago');
  const vencido = soma((l) => statusEfetivo(l, hoje) === 'atrasado');

  async function marcarComoPago(l) {
    try {
      await financeiroApi.markAsPaid(l.id);
      setFeedback(`Lançamento de R$ ${l.valor.toFixed(2)} marcado como pago.`);
      setTimeout(() => setFeedback(null), 4000);
      reload();
    } catch (err) {
      setErro(err.message);
    }
  }

  return html`
    <div>
      <${PageHeader} eyebrow="Financeiro" title="Contas a receber" />
      <div class="hf-stats-grid">
        <${StatCard} label="A receber" value=${`R$ ${aReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} tone="accent" />
        <${StatCard} label="Recebido" value=${`R$ ${recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <${StatCard} label="Vencido" value=${`R$ ${vencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
      </div>

      ${feedback && html`
        <div style=${{ background: 'rgba(51,193,122,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>
          ✓ ${feedback}
        </div>
      `}
      ${erro && html`
        <div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>
          ${erro}
        </div>
      `}

      ${!loading && lancamentos.length === 0
        ? html`<${EmptyState} icon="◇" title="Nenhum lançamento ainda" description="Lançamentos aparecem aqui automaticamente quando uma Ordem de Serviço é concluída com valor." />`
        : html`<${Table}
            columns=${[
              { key: 'cliente', label: 'Cliente', render: (r) => nomeCliente(r.cliente_id) },
              { key: 'descricao', label: 'Descrição' },
              { key: 'valor', label: 'Valor', render: (r) => `R$ ${r.valor.toFixed(2)}` },
              { key: 'vencimento', label: 'Vencimento' },
              { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('financeiro', statusEfetivo(r, hoje))}>${statusLabels.financeiro[statusEfetivo(r, hoje)]}<//>` },
              {
                key: 'acao', label: '',
                render: (r) => (r.status === 'pendente' || r.status === 'atrasado'
                  ? html`<${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); marcarComoPago(r); }}>Marcar como pago<//>`
                  : null),
              },
            ]}
            rows=${lancamentos}
          />`}
    </div>
  `;
}
