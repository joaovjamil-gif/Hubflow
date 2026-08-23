// src/pages/documentos.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, EmptyState, Card } from '../components/ui.js';

export function DocumentosPage() {
  return html`
    <div>
      <${PageHeader} eyebrow="Arquivos" title="Documentos" />
      <${Card} style=${{ marginBottom: 20 }}>
        <p style=${{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Upload real de PDFs, fotos e comprovantes exige armazenamento de arquivos em um backend
          (Supabase Storage, no plano de arquitetura). Sem isso conectado, qualquer upload aqui seria
          apenas visual — e preferimos deixar isso explícito a fingir que o arquivo foi salvo.
        </p>
      <//>
      <${EmptyState}
        icon="◇"
        title="Upload disponível após conectar o backend"
        description="Assim que o Supabase Storage estiver conectado, você poderá anexar documentos a clientes, orçamentos e ordens de serviço diretamente por aqui."
      />
    </div>
  `;
}
