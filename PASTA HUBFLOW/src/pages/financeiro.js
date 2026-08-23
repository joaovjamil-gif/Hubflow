// src/pages/financeiro.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, StatCard, Table, Badge, statusTone, EmptyState } from '../components/ui.js';
import { financeiroApi, clientesApi, statusLabels } from '../services/api.js';

export function FinanceiroPage() {
  const [lancamentos, setLancamentos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([financeiroApi.list(), clientesApi.list()]).then(([f, c]) => {
      setLancamentos(f);
      setClientes(c);
      setLoading(false);
    });
  }, []);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '—';
  const soma = (status) => lancamentos.filter((l) => l.status === status).reduce((s, l) => s + l.valor, 0);

  return html`
    <div>
      <${PageHeader} eyebrow="Financeiro" title="Contas a receber" />
      <div class="hf-stats-grid">
        <${StatCard} label="A receber" value=${`R$ ${(soma('pendente') + soma('atrasado')).toLocaleString('pt-BR')}`} tone="accent" />
        <${StatCard} label="Recebido" value=${`R$ ${soma('pago').toLocaleString('pt-BR')}`} />
        <${StatCard} label="Vencido" value=${`R$ ${soma('atrasado').toLocaleString('pt-BR')}`} />
      </div>
      ${!loading && lancamentos.length === 0
        ? html`<${EmptyState} icon="◇" title="Nenhum lançamento ainda" description="Lançamentos aparecem aqui automaticamente quando uma Ordem de Serviço é concluída." />`
        : html`<${Table}
            columns=${[
              { key: 'cliente', label: 'Cliente', render: (r) => nomeCliente(r.cliente_id) },
              { key: 'valor', label: 'Valor', render: (r) => `R$ ${r.valor}` },
              { key: 'vencimento', label: 'Vencimento' },
              { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('financeiro', r.status)}>${statusLabels.financeiro[r.status]}<//>` },
            ]}
            rows=${lancamentos}
          />`}
    </div>
  `;
}
