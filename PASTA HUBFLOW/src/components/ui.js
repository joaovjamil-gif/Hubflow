// src/components/ui.js
// Design system em componentes React. Sem etapa de build neste ambiente
// (sem acesso a npm/bundler) — usamos `htm` como sintaxe de template no lugar
// de JSX. A API dos componentes é a mesma que teriam em JSX puro; migrar para
// um projeto Vite real no futuro é só trocar html`<Tag/>` por <Tag/> mesmo.
import React from 'https://esm.sh/react@18';
import htm from 'https://esm.sh/htm@3';

export const html = htm.bind(React.createElement);

export function Button({ variant = 'primary', size = 'md', children, ...props }) {
  const base = 'hf-btn';
  const cls = [base, `hf-btn--${variant}`, size === 'lg' ? 'hf-btn--lg' : ''].filter(Boolean).join(' ');
  return html`<button class=${cls} ...${props}>${children}</button>`;
}

export function Badge({ tone = 'grey', children }) {
  return html`<span class=${`hf-badge hf-badge--${tone}`}>${children}</span>`;
}

export function statusTone(kind, status) {
  const map = {
    orcamento: { aprovado: 'green', enviado: 'yellow', visualizado: 'yellow', aguardando: 'yellow', rascunho: 'grey', recusado: 'red', expirado: 'red', cancelado: 'grey' },
    os: { concluida: 'green', em_andamento: 'orange', agendada: 'yellow', aberta: 'grey', aguardando: 'yellow', cancelada: 'red' },
    financeiro: { pago: 'green', pendente: 'yellow', atrasado: 'red', cancelado: 'grey' },
    fornecedor: { active: 'green', inactive: 'grey' },
    cliente: { active: 'green', inactive: 'grey', blocked: 'red' },
    agenda: { confirmado: 'yellow', pendente: 'grey', concluido: 'green', cancelado: 'red' },
  };
  return (map[kind] && map[kind][status]) || 'grey';
}

export function Card({ children, className = '' }) {
  return html`<div class=${`hf-card ${className}`}>${children}</div>`;
}

export function EmptyState({ title, description, actionLabel, onAction, icon = '·' }) {
  return html`
    <div class="hf-empty">
      <div class="hf-empty__icon">${icon}</div>
      <h3>${title}</h3>
      <p>${description}</p>
      ${actionLabel && html`<${Button} onClick=${onAction}>${actionLabel}<//>`}
    </div>
  `;
}

export function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return html`
    <div class="hf-modal-overlay" onClick=${onClose}>
      <div class="hf-modal" onClick=${(e) => e.stopPropagation()}>
        <div class="hf-modal__head">
          <h3>${title}</h3>
          <button class="hf-modal__close" onClick=${onClose} aria-label="Fechar">✕</button>
        </div>
        <div class="hf-modal__body">${children}</div>
      </div>
    </div>
  `;
}

export function Field({ label, children }) {
  return html`
    <label class="hf-field">
      <span>${label}</span>
      ${children}
    </label>
  `;
}

export function Input({ ...props }) {
  return html`<input class="hf-input" ...${props} />`;
}

export function Textarea({ ...props }) {
  return html`<textarea class="hf-input" ...${props} />`;
}

export function Select({ options, ...props }) {
  return html`
    <select class="hf-input" ...${props}>
      ${options.map((o) => html`<option value=${o.value}>${o.label}</option>`)}
    </select>
  `;
}

export function Table({ columns, rows, onRowClick, emptyLabel = 'Nada por aqui ainda.' }) {
  if (!rows.length) {
    return html`<p class="hf-table-empty">${emptyLabel}</p>`;
  }
  return html`
    <div class="hf-table-wrap">
      <table class="hf-table">
        <thead>
          <tr>${columns.map((c) => html`<th>${c.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${rows.map(
            (row) => html`
              <tr onClick=${() => onRowClick && onRowClick(row)} class=${onRowClick ? 'is-clickable' : ''}>
                ${columns.map((c) => html`<td>${c.render ? c.render(row) : row[c.key]}</td>`)}
              </tr>
            `
          )}
        </tbody>
      </table>
    </div>
  `;
}

export function PageHeader({ eyebrow, title, action }) {
  return html`
    <div class="hf-page-header">
      <div>
        ${eyebrow && html`<div class="hf-kicker">${eyebrow}</div>`}
        <h1>${title}</h1>
      </div>
      ${action}
    </div>
  `;
}

export function StatCard({ label, value, tone = 'default' }) {
  return html`
    <${Card} className="hf-stat">
      <div class="hf-stat__label">${label}</div>
      <div class=${`hf-stat__value ${tone === 'accent' ? 'is-accent' : ''}`}>${value}</div>
    <//>
  `;
}
