// src/pages/clientes.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Button, Table, Modal, Field, Input, Textarea, EmptyState, Card } from '../components/ui.js';
import { clientesApi, orcamentosApi, ordensServicoApi } from '../services/api.js';

export function ClientesPage() {
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selecionado, setSelecionado] = React.useState(null);
  const [form, setForm] = React.useState({ nome: '', telefone: '', email: '', endereco: '', observacoes: '' });

  function reload() {
    clientesApi.list().then((c) => { setClientes(c); setLoading(false); });
  }
  React.useEffect(reload, []);

  async function salvar(e) {
    e.preventDefault();
    await clientesApi.create(form);
    setForm({ nome: '', telefone: '', email: '', endereco: '', observacoes: '' });
    setModalOpen(false);
    reload();
  }

  if (selecionado) {
    return html`<${ClienteDetalhe} cliente=${selecionado} onVoltar=${() => setSelecionado(null)} />`;
  }

  return html`
    <div>
      <${PageHeader}
        eyebrow="CRM"
        title="Clientes"
        action=${html`<${Button} variant="primary" onClick=${() => setModalOpen(true)}>+ Novo cliente<//>`}
      />

      ${!loading && clientes.length === 0
        ? html`<${EmptyState}
            icon="◇"
            title="Nenhum cliente ainda"
            description="Cadastre seu primeiro cliente e comece a organizar seus orçamentos e serviços."
            actionLabel="Criar cliente"
            onAction=${() => setModalOpen(true)}
          />`
        : html`<${Table}
            columns=${[
              { key: 'nome', label: 'Nome' },
              { key: 'telefone', label: 'Telefone' },
              { key: 'email', label: 'E-mail' },
            ]}
            rows=${clientes}
            onRowClick=${(c) => setSelecionado(c)}
          />`}

      <${Modal} open=${modalOpen} title="Novo cliente" onClose=${() => setModalOpen(false)}>
        <form onSubmit=${salvar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Nome"><${Input} required value=${form.nome} onChange=${(e) => setForm({ ...form, nome: e.target.value })} /><//>
          <${Field} label="Telefone"><${Input} required value=${form.telefone} onChange=${(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-0000" /><//>
          <${Field} label="E-mail"><${Input} type="email" value=${form.email} onChange=${(e) => setForm({ ...form, email: e.target.value })} /><//>
          <${Field} label="Endereço"><${Input} value=${form.endereco} onChange=${(e) => setForm({ ...form, endereco: e.target.value })} /><//>
          <${Field} label="Observações"><${Textarea} rows="3" value=${form.observacoes} onChange=${(e) => setForm({ ...form, observacoes: e.target.value })} /><//>
          <${Button} type="submit" variant="primary">Salvar cliente<//>
        </form>
      <//>
    </div>
  `;
}

function ClienteDetalhe({ cliente, onVoltar }) {
  const [orcamentos, setOrcamentos] = React.useState([]);
  const [os, setOs] = React.useState([]);

  React.useEffect(() => {
    orcamentosApi.list().then((all) => setOrcamentos(all.filter((o) => o.cliente_id === cliente.id)));
    ordensServicoApi.list().then((all) => setOs(all.filter((o) => o.cliente_id === cliente.id)));
  }, [cliente.id]);

  return html`
    <div>
      <button onClick=${onVoltar} class="hf-btn hf-btn--ghost" style=${{ marginBottom: 20 }}>← Voltar</button>
      <${PageHeader} eyebrow="Cliente" title=${cliente.nome} />
      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Dados</h3>
          <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            Telefone: ${cliente.telefone}<br/>
            E-mail: ${cliente.email || '—'}<br/>
            Endereço: ${cliente.endereco || '—'}<br/>
            Observações: ${cliente.observacoes || '—'}
          </p>
        <//>
        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Histórico</h3>
          <p style=${{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>${orcamentos.length} orçamento(s) · ${os.length} ordem(ns) de serviço</p>
          <div style=${{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            ${orcamentos.map((o) => html`<div style=${{ fontSize: '0.85rem' }}>Orçamento ${o.numero} — R$ ${o.valor_total}</div>`)}
            ${os.map((o) => html`<div style=${{ fontSize: '0.85rem' }}>${o.numero} — ${o.servico}</div>`)}
          </div>
        <//>
      </div>
    </div>
  `;
}
