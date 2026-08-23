// src/pages/orcamentos.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Button, Table, Badge, statusTone, EmptyState, Field, Input, Select, Modal } from '../components/ui.js';
import { orcamentosApi, clientesApi, aprovarOrcamentoEGerarOS, statusLabels } from '../services/api.js';

export function OrcamentosPage({ navigate }) {
  const [orcamentos, setOrcamentos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({ cliente_id: '', descricao: '', valor_total: '', validade: '' });
  const [feedback, setFeedback] = React.useState(null);

  function reload() {
    Promise.all([orcamentosApi.list(), clientesApi.list()]).then(([o, c]) => {
      setOrcamentos(o);
      setClientes(c);
      setLoading(false);
    });
  }
  React.useEffect(reload, []);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '—';

  async function salvar(e) {
    e.preventDefault();
    await orcamentosApi.create({
      cliente_id: form.cliente_id,
      numero: `#${Math.floor(Math.random() * 900 + 100)}`,
      data: new Date().toISOString().slice(0, 10),
      validade: form.validade,
      descricao: form.descricao,
      itens: [],
      desconto: 0,
      valor_total: Number(form.valor_total) || 0,
      status: 'rascunho',
    });
    setForm({ cliente_id: '', descricao: '', valor_total: '', validade: '' });
    setModalOpen(false);
    reload();
  }

  async function aprovar(orc) {
    const { ordemServico } = await aprovarOrcamentoEGerarOS(orc.id);
    setFeedback(`Orçamento ${orc.numero} aprovado — ${ordemServico.numero} criada automaticamente.`);
    reload();
    setTimeout(() => setFeedback(null), 4000);
  }

  return html`
    <div>
      <${PageHeader}
        eyebrow="Orçamentos"
        title="Orçamentos"
        action=${html`<${Button} variant="primary" onClick=${() => setModalOpen(true)}>+ Novo orçamento<//>`}
      />

      ${feedback && html`
        <div style=${{ background: 'rgba(51,193,122,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>
          ✓ ${feedback}
        </div>
      `}

      ${!loading && orcamentos.length === 0
        ? html`<${EmptyState}
            icon="◇"
            title="Nenhum orçamento ainda"
            description="Crie seu primeiro orçamento e comece a organizar seus serviços."
            actionLabel="Criar orçamento"
            onAction=${() => setModalOpen(true)}
          />`
        : html`<${Table}
            columns=${[
              { key: 'numero', label: 'Número' },
              { key: 'cliente', label: 'Cliente', render: (r) => nomeCliente(r.cliente_id) },
              { key: 'valor_total', label: 'Valor', render: (r) => `R$ ${r.valor_total}` },
              { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('orcamento', r.status)}>${statusLabels.orcamento[r.status]}<//>` },
              {
                key: 'acao',
                label: '',
                render: (r) => (r.status !== 'aprovado' && r.status !== 'recusado'
                  ? html`<${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); aprovar(r); }}>Aprovar → gerar OS<//>`
                  : r.status === 'aprovado' ? html`<span style=${{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>OS gerada</span>` : null),
              },
            ]}
            rows=${orcamentos}
          />`}

      <${Modal} open=${modalOpen} title="Novo orçamento" onClose=${() => setModalOpen(false)}>
        <form onSubmit=${salvar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Cliente">
            <${Select}
              required
              value=${form.cliente_id}
              onChange=${(e) => setForm({ ...form, cliente_id: e.target.value })}
              options=${[{ value: '', label: 'Selecione...' }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
            />
          <//>
          <${Field} label="Descrição do serviço"><${Input} required value=${form.descricao} onChange=${(e) => setForm({ ...form, descricao: e.target.value })} /><//>
          <${Field} label="Valor total (R$)"><${Input} type="number" required value=${form.valor_total} onChange=${(e) => setForm({ ...form, valor_total: e.target.value })} /><//>
          <${Field} label="Validade"><${Input} type="date" value=${form.validade} onChange=${(e) => setForm({ ...form, validade: e.target.value })} /><//>
          <${Button} type="submit" variant="primary">Salvar como rascunho<//>
        </form>
      <//>
    </div>
  `;
}
