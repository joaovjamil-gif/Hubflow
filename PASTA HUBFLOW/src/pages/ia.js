// src/pages/ia.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Card, Field, Textarea, Button } from '../components/ui.js';

export function IAPage() {
  const [entrada, setEntrada] = React.useState('');
  const [gerando, setGerando] = React.useState(false);
  const [saida, setSaida] = React.useState('');

  function gerar(e) {
    e.preventDefault();
    // Sem backend/API de IA conectada neste ambiente — não simulamos uma resposta
    // "inteligente" fingindo ser modelo real. Deixamos o padrão de interação pronto
    // para quando uma API de geração de texto for conectada (ex.: Claude API via Edge Function).
    setGerando(true);
    setTimeout(() => {
      setGerando(false);
      setSaida('__NEEDS_BACKEND__');
    }, 500);
  }

  return html`
    <div>
      <${PageHeader} eyebrow="Em breve" title="Marketing com IA" />
      <${Card}>
        <h3 style=${{ marginBottom: 6 }}>Gerar descrição de serviço</h3>
        <p style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 18 }}>
          Descreva o serviço em poucas palavras e a IA gera um texto profissional para o orçamento.
        </p>
        <form onSubmit=${gerar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Descreva o serviço">
            <${Textarea} rows="3" required value=${entrada} onChange=${(e) => setEntrada(e.target.value)} placeholder="Ex.: Instalação de ar-condicionado de 12.000 BTUs" />
          <//>
          <${Button} type="submit" variant="primary" disabled=${gerando}>${gerando ? 'Gerando...' : 'Gerar descrição'}<//>
        </form>
        ${saida && html`
          <div style=${{ marginTop: 18, padding: 14, border: '1px dashed var(--border)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Este módulo precisa de uma API de geração de texto conectada (ex.: Claude API através de uma
            Edge Function do Supabase) para gerar respostas reais. A interface já está pronta para receber
            essa conexão — hoje ela não gera nenhum texto para não fingir uma resposta que não existe.
          </div>
        `}
      <//>
    </div>
  `;
}
