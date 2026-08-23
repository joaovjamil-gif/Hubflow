// src/pages/ordensServico.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Table, Badge, statusTone, EmptyState, Card, Button } from '../components/ui.js';
import { ordensServicoApi, clientesApi, concluirOSEGerarLancamento, statusLabels } from '../services/api.js';

export function OrdensServicoPage() {
  const [os, setOs] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selecionada, setSelecionada] = React.useState(null);
  const [feedback, setFeedback] = React.useState(null);

  function reload() {
    Promise.all([ordensServicoApi.list(), clientesApi.list()]).then(([o, c]) => {
      setOs(o);
      setClientes(c);
      setLoading(false);
    });
  }
  React.useEffect(reload, []);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '—';

  async function concluir(item) {
    await concluirOSEGerarLancamento(item.id, '2026-09-05');
    setFeedback(`${item.numero} concluída — lançamento financeiro gerado.`);
    reload();
    setSelecionada(null);
    setTimeout(() => setFeedback(null), 4000);
  }

  if (selecionada) {
    return html`
      <div>
        <button onClick=${() => setSelecionada(null)} class="hf-btn hf-btn--ghost" style=${{ marginBottom: 20 }}>← Voltar</button>
        <${PageHeader}
          eyebrow=${selecionada.numero}
          title=${selecionada.servico}
          action=${selecionada.status !== 'concluida' && html`<${Button} variant="primary" onClick=${() => concluir(selecionada)}>Marcar como concluída<//>`}
        />
        <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Detalhes</h3>
            <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
              Cliente: ${nomeCliente(selecionada.cliente_id)}<br/>
              Responsável: ${selecionada.responsavel}<br/>
              Data: ${selecionada.data || 'A definir'} ${selecionada.horario || ''}<br/>
              Endereço: ${selecionada.endereco || '—'}<br/>
              Valor: R$ ${selecionada.valor}
            </p>
          <//>
          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Status</h3>
            <${Badge} tone=${statusTone('os', selecionada.status)}>${statusLabels.os[selecionada.status]}<//>
            <p style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 14 }}>${selecionada.descricao}</p>
          <//>
        </div>
      </div>
    `;
  }

  return html`
    <div>
      <${PageHeader} eyebrow="Operação" title="Ordens de Serviço" />
      ${feedback && html`
        <div style=${{ background: 'rgba(51,193,122,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>
          ✓ ${feedback}
        </div>
      `}
      ${!loading && os.length === 0
        ? html`<${EmptyState} icon="◇" title="Nenhuma OS ainda" description="Ordens de serviço aparecem aqui quando um orçamento é aprovado, ou você pode criar diretamente na integração futura." />`
        : html`<${Table}
            columns=${[
              { key: 'numero', label: 'Número' },
              { key: 'servico', label: 'Serviço' },
              { key: 'cliente', label: 'Cliente', render: (r) => nomeCliente(r.cliente_id) },
              { key: 'data', label: 'Data', render: (r) => (r.data ? `${r.data} ${r.horario || ''}` : 'A definir') },
              { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('os', r.status)}>${statusLabels.os[r.status]}<//>` },
            ]}
            rows=${os}
            onRowClick=${setSelecionada}
          />`}
    </div>
  `;
}
