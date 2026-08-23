// src/components/documentsPanel.js
//
// Painel reutilizável de documentos (upload/lista/download/exclusão) sobre
// Supabase Storage real (ver services/documents.js). Usado nas telas de
// detalhe de Cliente, Orçamento, OS, Fornecedor e Financeiro — qualquer
// entidade cujo entity_type é aceito por public.documents.
import React from 'https://esm.sh/react@18';
import { html, Card, Spinner } from './ui.js';
import { documentosApi } from '../services/api.js';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconeDoc(mime) {
  if (!mime) return '◇';
  if (mime.startsWith('image/')) return '▧';
  if (mime === 'application/pdf') return '▤';
  if (mime.includes('sheet') || mime.includes('excel')) return '▦';
  return '▣';
}

export function DocumentsPanel({ entityType, entityId, title = 'Documentos' }) {
  const [docs, setDocs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [arrastando, setArrastando] = React.useState(false);
  const inputRef = React.useRef(null);

  function reload() {
    if (!entityId) return;
    setLoading(true);
    documentosApi
      .list(entityType, entityId)
      .then(setDocs)
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, [entityType, entityId]);

  async function enviarArquivos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErro('');
    setEnviando(true);
    try {
      for (const file of files) {
        await documentosApi.upload(entityType, entityId, file);
      }
      reload();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function baixar(doc) {
    try {
      const url = await documentosApi.getSignedUrl(doc);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setErro(err.message);
    }
  }

  async function excluir(doc) {
    if (!window.confirm(`Remover "${doc.nomeOriginal}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await documentosApi.remove(doc);
      reload();
    } catch (err) {
      setErro(err.message);
    }
  }

  return html`
    <${Card}>
      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style=${{ fontSize: '0.95rem', margin: 0 }}>${title}</h3>
        ${docs.length > 0 && html`<span style=${{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>${docs.length} arquivo${docs.length === 1 ? '' : 's'}</span>`}
      </div>

      <label
        class=${`hf-upload-zone ${arrastando ? 'is-dragover' : ''}`}
        onDragOver=${(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave=${() => setArrastando(false)}
        onDrop=${(e) => { e.preventDefault(); setArrastando(false); enviarArquivos(e.dataTransfer.files); }}
      >
        ${enviando ? html`<${Spinner} label="Enviando..." />` : html`Arraste um arquivo aqui ou clique para escolher (PDF, imagem, planilha...)`}
        <input ref=${inputRef} type="file" multiple onChange=${(e) => { enviarArquivos(e.target.files); e.target.value = ''; }} />
      </label>

      ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 10 }}>${erro}</p>`}

      ${loading
        ? html`<${Spinner} />`
        : docs.length === 0
        ? html`<p style=${{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: 14 }}>Nenhum documento anexado ainda.</p>`
        : html`
            <div class="hf-doc-list">
              ${docs.map(
                (doc) => html`
                  <div class="hf-doc-item" key=${doc.id}>
                    <span class="hf-doc-item__icon">${iconeDoc(doc.tipoMime)}</span>
                    <div class="hf-doc-item__info">
                      <div class="hf-doc-item__name">${doc.nomeOriginal}</div>
                      <div class="hf-doc-item__meta">
                        ${formatBytes(doc.tamanhoBytes)}${doc.categoria ? ` · ${doc.categoria}` : ''} · ${new Date(doc.criadoEm).toLocaleDateString('pt-BR')}
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
  `;
}
