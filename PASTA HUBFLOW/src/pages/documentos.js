// src/pages/documentos.js
//
// Navegador central de documentos: todos os arquivos enviados em qualquer
// entidade (clientes, orçamentos, OS, fornecedores) aparecem aqui, com busca
// e filtro por tipo — além de um espaço para documentos gerais da empresa
// (contratos, políticas, certificados) que não pertencem a um registro
// específico (entity_type = 'organization').
import React from 'https://esm.sh/react@18';
import { html, PageHeader, EmptyState, Card, Select, Input, Spinner } from '../components/ui.js';
import { documentosApi } from '../services/api.js';
import { DocumentsPanel } from '../components/documentsPanel.js';

const ENTITY_LABELS = {
  customer: 'Cliente',
  quote: 'Orçamento',
  work_order: 'Ordem de serviço',
  supplier: 'Fornecedor',
  organization: 'Empresa',
  financial: 'Financeiro',
  profile: 'Perfil',
};

const ENTITY_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
];

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentosPage({ organization }) {
  const [docs, setDocs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');

  function reload() {
    setLoading(true);
    documentosApi
      .listRecent({ search: busca, entityType: tipo })
      .then(setDocs)
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, [busca, tipo]);

  async function baixar(doc) {
    try {
      const url = await documentosApi.getSignedUrl(doc);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setErro(err.message);
    }
  }

  async function excluir(doc) {
    if (!window.confirm(`Remover "${doc.nomeOriginal}"?`)) return;
    try {
      await documentosApi.remove(doc);
      reload();
    } catch (err) {
      setErro(err.message);
    }
  }

  return html`
    <div>
      <${PageHeader} eyebrow="Arquivos" title="Documentos" />

      <div style=${{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20, alignItems: 'start' }}>
        <${Card}>
          <div style=${{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style=${{ maxWidth: 300, flex: 1 }}>
              <${Input} placeholder="Buscar por nome ou categoria..." value=${busca} onChange=${(e) => setBusca(e.target.value)} />
            </div>
            <div style=${{ maxWidth: 200 }}>
              <${Select} value=${tipo} onChange=${(e) => setTipo(e.target.value)} options=${ENTITY_OPTIONS} />
            </div>
          </div>

          ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: 12 }}>${erro}</p>`}

          ${loading
            ? html`<${Spinner} />`
            : docs.length === 0
            ? html`<${EmptyState}
                icon="◇"
                title="Nenhum documento encontrado"
                description="Anexe arquivos direto na tela de um cliente, orçamento, OS ou fornecedor — eles aparecem aqui automaticamente."
              />`
            : html`
                <div class="hf-doc-list">
                  ${docs.map(
                    (doc) => html`
                      <div class="hf-doc-item" key=${doc.id}>
                        <span class="hf-doc-item__icon">▣</span>
                        <div class="hf-doc-item__info">
                          <div class="hf-doc-item__name">${doc.nomeOriginal}</div>
                          <div class="hf-doc-item__meta">
                            ${ENTITY_LABELS[doc.entidadeTipo] || doc.entidadeTipo} · ${formatBytes(doc.tamanhoBytes)} · ${new Date(doc.criadoEm).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div class="hf-doc-item__actions">
                          <button class="hf-btn hf-btn--ghost" style=${{ padding: '5px 10px', fontSize: '0.76rem' }} onClick=${() => baixar(doc)}>Abrir</button>
                          <button class="hf-btn hf-btn--ghost" style=${{ padding: '5px 10px', fontSize: '0.76rem', color: 'var(--danger)' }} onClick=${() => excluir(doc)}>Remover</button>
                        </div>
                      </div>
                    `
                  )}
                </div>
              `}
        <//>

        ${organization?.id && html`<${DocumentsPanel} entityType="organization" entityId=${organization.id} title="Documentos gerais da empresa" />`}
      </div>
    </div>
  `;
}
