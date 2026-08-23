// src/pages/servicos.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Button, Table, Badge, EmptyState, Field, Input, Textarea, Modal } from '../components/ui.js';
import { catalogoApi } from '../services/api.js';

const FORM_VAZIO = { nome: '', descricao: '', categoria: '', codigo: '', preco_padrao: 0, unidade: 'un', custo: '', margem: '' };

export function ServicosPage() {
  const [itens, setItens] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editando, setEditando] = React.useState(null);
  const [form, setForm] = React.useState(FORM_VAZIO);
  const [salvando, setSalvando] = React.useState(false);

  function reload() {
    setLoading(true);
    catalogoApi.list({ search: busca })
      .then(setItens)
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, [busca]);

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setModalOpen(true);
  }
  function abrirEdicao(item) {
    setEditando(item);
    setForm({ ...item, custo: item.custo ?? '', margem: item.margem ?? '' });
    setModalOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      if (editando) await catalogoApi.update(editando.id, form);
      else await catalogoApi.create({ ...form, ativo: true });
      setModalOpen(false);
      reload();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(item) {
    try {
      await catalogoApi.setActive(item.id, !item.ativo);
      reload();
    } catch (err) {
      setErro(err.message);
    }
  }

  return html`
    <div>
      <${PageHeader}
        eyebrow="Catálogo"
        title="Serviços"
        action=${html`<${Button} variant="primary" onClick=${abrirNovo}>+ Novo serviço<//>`}
      />

      <div style=${{ marginBottom: 20, maxWidth: 320 }}>
        <${Input} placeholder="Buscar por nome..." value=${busca} onChange=${(e) => setBusca(e.target.value)} />
      </div>

      ${erro && html`<div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>${erro}</div>`}

      ${!loading && itens.length === 0
        ? html`<${EmptyState} icon="◇" title="Nenhum serviço cadastrado" description="Cadastre os serviços que você oferece para usá-los em orçamentos e OS." actionLabel="Criar serviço" onAction=${abrirNovo} />`
        : html`<${Table}
            columns=${[
              { key: 'nome', label: 'Nome' },
              { key: 'categoria', label: 'Categoria', render: (r) => r.categoria || '—' },
              { key: 'preco_padrao', label: 'Preço padrão', render: (r) => `R$ ${r.preco_padrao.toFixed(2)}` },
              { key: 'unidade', label: 'Unidade' },
              { key: 'ativo', label: 'Status', render: (r) => html`<${Badge} tone=${r.ativo ? 'green' : 'grey'}>${r.ativo ? 'Ativo' : 'Inativo'}<//>` },
              {
                key: 'acao', label: '',
                render: (r) => html`
                  <div style=${{ display: 'flex', gap: 8 }}>
                    <${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); abrirEdicao(r); }}>Editar<//>
                    <${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); alternarAtivo(r); }}>${r.ativo ? 'Desativar' : 'Ativar'}<//>
                  </div>
                `,
              },
            ]}
            rows=${itens}
          />`}

      <${Modal} open=${modalOpen} title=${editando ? 'Editar serviço' : 'Novo serviço'} onClose=${() => setModalOpen(false)}>
        <form onSubmit=${salvar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Nome"><${Input} required value=${form.nome} onChange=${(e) => setForm({ ...form, nome: e.target.value })} /><//>
          <${Field} label="Descrição"><${Textarea} rows="2" value=${form.descricao} onChange=${(e) => setForm({ ...form, descricao: e.target.value })} /><//>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="Categoria"><${Input} value=${form.categoria} onChange=${(e) => setForm({ ...form, categoria: e.target.value })} /><//>
            <${Field} label="Código interno"><${Input} value=${form.codigo} onChange=${(e) => setForm({ ...form, codigo: e.target.value })} /><//>
          </div>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="Preço padrão (R$)"><${Input} type="number" min="0" step="0.01" value=${form.preco_padrao} onChange=${(e) => setForm({ ...form, preco_padrao: e.target.value })} /><//>
            <${Field} label="Unidade"><${Input} value=${form.unidade} onChange=${(e) => setForm({ ...form, unidade: e.target.value })} placeholder="un, h, m²..." /><//>
          </div>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="Custo (R$)"><${Input} type="number" min="0" step="0.01" value=${form.custo} onChange=${(e) => setForm({ ...form, custo: e.target.value })} /><//>
            <${Field} label="Margem (%)"><${Input} type="number" min="0" step="0.1" value=${form.margem} onChange=${(e) => setForm({ ...form, margem: e.target.value })} /><//>
          </div>
          ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
          <${Button} type="submit" variant="primary" disabled=${salvando}>${salvando ? 'Salvando...' : 'Salvar'}<//>
        </form>
      <//>
    </div>
  `;
}
