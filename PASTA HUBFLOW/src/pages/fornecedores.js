// src/pages/fornecedores.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Button, Table, Badge, statusTone, EmptyState, Field, Input, Textarea, Modal, Card, Timeline } from '../components/ui.js';
import { fornecedoresApi, contasPagarApi, statusLabels } from '../services/api.js';
import { listActivity } from '../services/activity.js';
import { DocumentsPanel } from '../components/documentsPanel.js';

const FORM_VAZIO = { nome: '', razao_social: '', documento: '', email: '', telefone: '', endereco: '', categoria: '', observacoes: '' };

export function FornecedoresPage() {
  const [fornecedores, setFornecedores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [form, setForm] = React.useState(FORM_VAZIO);
  const [selecionado, setSelecionado] = React.useState(null);

  function reload() {
    setLoading(true);
    fornecedoresApi.list({ search: busca }).then(setFornecedores).catch((err) => setErro(err.message)).finally(() => setLoading(false));
  }
  React.useEffect(reload, [busca]);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await fornecedoresApi.create(form);
      setForm(FORM_VAZIO);
      setModalOpen(false);
      reload();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (selecionado) {
    return html`<${FornecedorDetalhe} fornecedor=${selecionado} onVoltar=${() => { setSelecionado(null); reload(); }} />`;
  }

  return html`
    <div>
      <${PageHeader} eyebrow="Cadastro" title="Fornecedores" action=${html`<${Button} variant="primary" onClick=${() => setModalOpen(true)}>+ Novo fornecedor<//>`} />
      <div style=${{ marginBottom: 20, maxWidth: 320 }}>
        <${Input} placeholder="Buscar por nome ou documento..." value=${busca} onChange=${(e) => setBusca(e.target.value)} />
      </div>
      ${erro && html`<div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>${erro}</div>`}
      ${!loading && fornecedores.length === 0
        ? html`<${EmptyState} icon="◇" title="Nenhum fornecedor ainda" description="Cadastre fornecedores para vincular às contas a pagar." actionLabel="Criar fornecedor" onAction=${() => setModalOpen(true)} />`
        : html`<${Table}
            columns=${[
              { key: 'nome', label: 'Nome' },
              { key: 'documento', label: 'Documento', render: (r) => r.documento || '—' },
              { key: 'telefone', label: 'Telefone', render: (r) => r.telefone || '—' },
              { key: 'categoria', label: 'Categoria', render: (r) => r.categoria || '—' },
              { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('fornecedor', r.status)}>${statusLabels.fornecedor[r.status] || r.status}<//>` },
            ]}
            rows=${fornecedores}
            onRowClick=${setSelecionado}
          />`}

      <${Modal} open=${modalOpen} title="Novo fornecedor" onClose=${() => setModalOpen(false)}>
        <form onSubmit=${salvar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Nome"><${Input} required value=${form.nome} onChange=${(e) => setForm({ ...form, nome: e.target.value })} /><//>
          <${Field} label="Razão social"><${Input} value=${form.razao_social} onChange=${(e) => setForm({ ...form, razao_social: e.target.value })} /><//>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="CPF/CNPJ"><${Input} value=${form.documento} onChange=${(e) => setForm({ ...form, documento: e.target.value })} /><//>
            <${Field} label="Categoria"><${Input} value=${form.categoria} onChange=${(e) => setForm({ ...form, categoria: e.target.value })} /><//>
          </div>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="E-mail"><${Input} type="email" value=${form.email} onChange=${(e) => setForm({ ...form, email: e.target.value })} /><//>
            <${Field} label="Telefone"><${Input} value=${form.telefone} onChange=${(e) => setForm({ ...form, telefone: e.target.value })} /><//>
          </div>
          <${Field} label="Endereço"><${Input} value=${form.endereco} onChange=${(e) => setForm({ ...form, endereco: e.target.value })} /><//>
          <${Field} label="Observações"><${Textarea} rows="2" value=${form.observacoes} onChange=${(e) => setForm({ ...form, observacoes: e.target.value })} /><//>
          ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
          <${Button} type="submit" variant="primary" disabled=${salvando}>${salvando ? 'Salvando...' : 'Salvar fornecedor'}<//>
        </form>
      <//>
    </div>
  `;
}

function FornecedorDetalhe({ fornecedor, onVoltar }) {
  const [contas, setContas] = React.useState([]);
  const [historico, setHistorico] = React.useState([]);

  React.useEffect(() => {
    contasPagarApi.list().then((todas) => setContas(todas.filter((c) => c.fornecedor_id === fornecedor.id)));
    listActivity('suppliers', fornecedor.id).then(setHistorico);
  }, [fornecedor.id]);

  return html`
    <div>
      <button onClick=${onVoltar} class="hf-btn hf-btn--ghost" style=${{ marginBottom: 20 }}>← Voltar</button>
      <${PageHeader} eyebrow="Fornecedor" title=${fornecedor.nome} />
      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Dados</h3>
          <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            Documento: ${fornecedor.documento || '—'}<br/>
            E-mail: ${fornecedor.email || '—'}<br/>
            Telefone: ${fornecedor.telefone || '—'}<br/>
            Categoria: ${fornecedor.categoria || '—'}<br/>
            Endereço: ${fornecedor.endereco || '—'}
          </p>
        <//>
        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Contas a pagar</h3>
          ${contas.length === 0
            ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Nenhuma conta ainda.</p>`
            : contas.map((c) => html`<div key=${c.id} style=${{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}><span>${c.descricao}</span><span>R$ ${c.valor.toFixed(2)} · ${c.status}</span></div>`)}
        <//>
      </div>
      <div style=${{ marginTop: 20, display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Histórico</h3>
          <${Timeline} items=${historico} emptyLabel="Sem eventos ainda." />
        <//>
        <${DocumentsPanel} entityType="supplier" entityId=${fornecedor.id} />
      </div>
    </div>
  `;
}
