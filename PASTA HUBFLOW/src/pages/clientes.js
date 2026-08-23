// src/pages/clientes.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Button, Table, Badge, statusTone, Modal, Field, Input, Select, Textarea, EmptyState, Card } from '../components/ui.js';
import { clientesApi, orcamentosApi, ordensServicoApi, financeiroApi, contatosClienteApi, listDocumentosDaEntidade, statusLabels } from '../services/api.js';
import { listActivity } from '../services/activity.js';

const FORM_VAZIO = { nome: '', telefone: '', email: '', endereco: '', observacoes: '', status: 'active' };
const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'blocked', label: 'Bloqueado' },
];

export function ClientesPage() {
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [filtroStatus, setFiltroStatus] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editando, setEditando] = React.useState(null);
  const [selecionado, setSelecionado] = React.useState(null);
  const [form, setForm] = React.useState(FORM_VAZIO);
  const [salvando, setSalvando] = React.useState(false);

  function reload() {
    setLoading(true);
    clientesApi.list({ search: busca, status: filtroStatus })
      .then(setClientes)
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, [busca, filtroStatus]);

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setModalOpen(true);
  }
  function abrirEdicao(cliente) {
    setEditando(cliente);
    setForm({ nome: cliente.nome, telefone: cliente.telefone, email: cliente.email, endereco: cliente.endereco, observacoes: cliente.observacoes, status: cliente.status || 'active' });
    setModalOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      let atualizado;
      if (editando) atualizado = await clientesApi.update(editando.id, form);
      else atualizado = await clientesApi.create(form);
      setModalOpen(false);
      // Se estávamos editando o cliente que está aberto no detalhe, atualiza a tela também.
      if (selecionado && editando && selecionado.id === editando.id) setSelecionado(atualizado);
      reload();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar cliente.');
    } finally {
      setSalvando(false);
    }
  }

  const editModal = html`
    <${Modal} open=${modalOpen} title=${editando ? 'Editar cliente' : 'Novo cliente'} onClose=${() => setModalOpen(false)}>
      <form onSubmit=${salvar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <${Field} label="Nome"><${Input} required value=${form.nome} onChange=${(e) => setForm({ ...form, nome: e.target.value })} /><//>
        <${Field} label="Telefone"><${Input} required value=${form.telefone} onChange=${(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-0000" /><//>
        <${Field} label="E-mail"><${Input} type="email" value=${form.email} onChange=${(e) => setForm({ ...form, email: e.target.value })} /><//>
        <${Field} label="Endereço"><${Input} value=${form.endereco} onChange=${(e) => setForm({ ...form, endereco: e.target.value })} /><//>
        ${editando && html`
          <${Field} label="Status">
            <${Select} value=${form.status} onChange=${(e) => setForm({ ...form, status: e.target.value })} options=${[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Inativo' }, { value: 'blocked', label: 'Bloqueado' }]} />
          <//>
        `}
        <${Field} label="Observações"><${Textarea} rows="3" value=${form.observacoes} onChange=${(e) => setForm({ ...form, observacoes: e.target.value })} /><//>
        ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
        <${Button} type="submit" variant="primary" disabled=${salvando}>${salvando ? 'Salvando...' : 'Salvar cliente'}<//>
      </form>
    <//>
  `;

  if (selecionado) {
    return html`
      <div>
        <${ClienteDetalhe} cliente=${selecionado} onVoltar=${() => setSelecionado(null)} onEditar=${() => abrirEdicao(selecionado)} />
        ${editModal}
      </div>
    `;
  }

  return html`
    <div>
      <${PageHeader}
        eyebrow="CRM"
        title="Clientes"
        action=${html`<${Button} variant="primary" onClick=${abrirNovo}>+ Novo cliente<//>`}
      />

      <div style=${{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style=${{ maxWidth: 320, flex: 1 }}>
          <${Input} placeholder="Buscar por nome, documento, telefone ou e-mail..." value=${busca} onChange=${(e) => setBusca(e.target.value)} />
        </div>
        <div style=${{ maxWidth: 200 }}>
          <${Select} value=${filtroStatus} onChange=${(e) => setFiltroStatus(e.target.value)} options=${STATUS_OPTIONS} />
        </div>
      </div>

      ${erro && html`<div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>${erro}</div>`}

      ${!loading && clientes.length === 0
        ? html`<${EmptyState}
            icon="◇"
            title="Nenhum cliente encontrado"
            description="Cadastre seu primeiro cliente e comece a organizar seus orçamentos e serviços."
            actionLabel="Criar cliente"
            onAction=${abrirNovo}
          />`
        : html`<${Table}
            columns=${[
              { key: 'nome', label: 'Nome' },
              { key: 'telefone', label: 'Telefone' },
              { key: 'email', label: 'E-mail' },
              { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('cliente', r.status)}>${r.status === 'active' ? 'Ativo' : r.status === 'blocked' ? 'Bloqueado' : 'Inativo'}<//>` },
              { key: 'acao', label: '', render: (r) => html`<${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); abrirEdicao(r); }}>Editar<//>` },
            ]}
            rows=${clientes}
            onRowClick=${(c) => setSelecionado(c)}
          />`}

      ${editModal}
    </div>
  `;
}

function ClienteDetalhe({ cliente, onVoltar, onEditar }) {
  const [orcamentos, setOrcamentos] = React.useState([]);
  const [os, setOs] = React.useState([]);
  const [financeiro, setFinanceiro] = React.useState([]);
  const [contatos, setContatos] = React.useState([]);
  const [documentos, setDocumentos] = React.useState([]);
  const [historico, setHistorico] = React.useState([]);
  const [novoContato, setNovoContato] = React.useState({ nome: '', funcao: '', telefone: '', email: '' });
  const [erro, setErro] = React.useState('');

  function carregar() {
    orcamentosApi.list().then((all) => setOrcamentos(all.filter((o) => o.cliente_id === cliente.id)));
    ordensServicoApi.list().then((all) => setOs(all.filter((o) => o.cliente_id === cliente.id)));
    financeiroApi.list().then((all) => setFinanceiro(all.filter((f) => f.cliente_id === cliente.id)));
    contatosClienteApi.list(cliente.id).then(setContatos);
    listDocumentosDaEntidade('customer', cliente.id).then(setDocumentos).catch(() => setDocumentos([]));
    listActivity('customers', cliente.id).then(setHistorico);
  }
  React.useEffect(carregar, [cliente.id]);

  async function adicionarContato(e) {
    e.preventDefault();
    if (!novoContato.nome) return;
    try {
      await contatosClienteApi.create(cliente.id, novoContato);
      setNovoContato({ nome: '', funcao: '', telefone: '', email: '' });
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }
  async function removerContato(id) {
    try {
      await contatosClienteApi.remove(id);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  return html`
    <div>
      <button onClick=${onVoltar} class="hf-btn hf-btn--ghost" style=${{ marginBottom: 20 }}>← Voltar</button>
      <${PageHeader} eyebrow="Cliente" title=${cliente.nome} action=${html`<${Button} variant="ghost" onClick=${onEditar}>Editar<//>`} />
      ${erro && html`<div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>${erro}</div>`}

      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Dados</h3>
          <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            Telefone: ${cliente.telefone}<br/>
            E-mail: ${cliente.email || '—'}<br/>
            Endereço: ${cliente.endereco || '—'}<br/>
            Documento: ${cliente.documento || '—'}<br/>
            Observações: ${cliente.observacoes || '—'}
          </p>
        <//>

        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Contatos</h3>
          ${contatos.length === 0
            ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Nenhum contato adicional.</p>`
            : contatos.map((c) => html`
                <div key=${c.id} style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <span>${c.nome}${c.funcao ? ` (${c.funcao})` : ''} — ${c.telefone || c.email || '—'}</span>
                  <button onClick=${() => removerContato(c.id)} class="hf-btn hf-btn--ghost" style=${{ padding: '4px 8px', fontSize: '0.75rem' }}>Remover</button>
                </div>
              `)}
          <form onSubmit=${adicionarContato} style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 12 }}>
            <${Input} placeholder="Nome" value=${novoContato.nome} onChange=${(e) => setNovoContato({ ...novoContato, nome: e.target.value })} />
            <${Input} placeholder="Telefone" value=${novoContato.telefone} onChange=${(e) => setNovoContato({ ...novoContato, telefone: e.target.value })} />
            <${Button} type="submit" variant="ghost">+ Add<//>
          </form>
        <//>

        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Orçamentos</h3>
          ${orcamentos.length === 0
            ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Nenhum orçamento ainda.</p>`
            : orcamentos.map((o) => html`<div key=${o.id} style=${{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}><span>${o.numero}</span><span>R$ ${o.valor_total.toFixed(2)} · ${statusLabels.orcamento[o.status]}</span></div>`)}
        <//>

        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Ordens de serviço</h3>
          ${os.length === 0
            ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Nenhuma OS ainda.</p>`
            : os.map((o) => html`<div key=${o.id} style=${{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}><span>${o.numero}</span><span>${statusLabels.os[o.status]}</span></div>`)}
        <//>

        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Financeiro</h3>
          ${financeiro.length === 0
            ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Nenhum lançamento ainda.</p>`
            : financeiro.map((f) => html`<div key=${f.id} style=${{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}><span>${f.descricao}</span><span>R$ ${f.valor.toFixed(2)} · ${statusLabels.financeiro[f.status]}</span></div>`)}
        <//>

        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Documentos</h3>
          ${documentos.length === 0
            ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Nenhum documento anexado ainda — upload chega numa próxima etapa.</p>`
            : documentos.map((d) => html`<div key=${d.id} style=${{ fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>${d.original_name}</div>`)}
        <//>
      </div>

      <div style=${{ marginTop: 20 }}>
        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Histórico</h3>
          ${historico.length === 0
            ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Sem eventos ainda.</p>`
            : html`<div style=${{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                ${historico.map((h) => html`
                  <div key=${h.id} style=${{ fontSize: '0.85rem', borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
                    <strong>${h.acao}</strong> — ${h.descricao}
                    <div style=${{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>${new Date(h.quando).toLocaleString('pt-BR')}</div>
                  </div>
                `)}
              </div>`}
        <//>
      </div>
    </div>
  `;
}
