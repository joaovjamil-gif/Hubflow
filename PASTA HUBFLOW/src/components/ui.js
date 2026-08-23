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

export function Spinner({ label = 'Carregando...' }) {
  return html`<div class="hf-spinner"><span class="hf-spinner__dot"></span>${label}</div>`;
}

/** Gráfico de barras verticais simples, em CSS puro — sem lib externa. `data`: [{label, value, color?}]. */
export function BarChart({ data, height = 160, formatValue = (v) => v, emptyLabel = 'Sem dados ainda.' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => !d.value)) return html`<p class="hf-table-empty">${emptyLabel}</p>`;
  return html`
    <div class="hf-barchart" style=${{ height: `${height}px` }}>
      ${data.map(
        (d) => html`
          <div class="hf-barchart__col" key=${d.label}>
            <div class="hf-barchart__value">${formatValue(d.value)}</div>
            <div class="hf-barchart__bar" style=${{ height: `${Math.max(3, (d.value / max) * 100)}%`, background: d.color || 'var(--accent)' }}></div>
            <div class="hf-barchart__label">${d.label}</div>
          </div>
        `
      )}
    </div>
  `;
}

/** Gráfico de rosca via conic-gradient (CSS puro). `segments`: [{label, value, color}]. */
export function DonutChart({ segments, size = 132, thickness = 18, emptyLabel = 'Sem dados ainda.' }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return html`<p class="hf-table-empty">${emptyLabel}</p>`;
  let acc = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = (acc / total) * 100;
      acc += s.value;
      const end = (acc / total) * 100;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(', ');
  return html`
    <div class="hf-donut">
      <div class="hf-donut__ring" style=${{ width: size, height: size, background: `conic-gradient(${stops})` }}>
        <div class="hf-donut__hole" style=${{ inset: `${thickness}px` }}></div>
      </div>
      <div class="hf-donut__legend">
        ${segments.map(
          (s) => html`
            <div class="hf-donut__legend-item" key=${s.label}>
              <span class="hf-donut__dot" style=${{ background: s.color }}></span>
              ${s.label} <span class="hf-donut__legend-value">(${s.value})</span>
            </div>
          `
        )}
      </div>
    </div>
  `;
}

/**
 * Painel flutuante genérico (usado por notificações, menus etc.). O
 * disparador (botão) fica fora deste componente, dentro de um wrapper com
 * `class="hf-dropdown-wrap"` (position: relative) — ver notificationsBell.js
 * para um exemplo completo.
 */
export function Dropdown({ open, onClose, align = 'right', className = '', children }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onEsc(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);
  if (!open) return null;
  return html`<div ref=${ref} class=${`hf-dropdown hf-dropdown--${align} ${className}`}>${children}</div>`;
}

/** Texto de apoio ao passar o mouse/focar — usa CSS puro (::after), sem lib externa. */
export function Tooltip({ label, children }) {
  return html`<span class="hf-tooltip" data-tooltip=${label} tabIndex="0">${children}</span>`;
}

const ACTIVITY_TONE = {
  Criado: 'green',
  Aprovado: 'green',
  Concluído: 'green',
  Atualizado: 'yellow',
  Recusado: 'red',
  Cancelado: 'red',
  Excluído: 'red',
};

/** Histórico de uma entidade em formato de linha do tempo vertical (ver services/activity.js). */
export function Timeline({ items, emptyLabel = 'Nenhum evento registrado ainda.' }) {
  if (!items || !items.length) return html`<p class="hf-table-empty">${emptyLabel}</p>`;
  return html`
    <div class="hf-timeline">
      ${items.map(
        (it) => html`
          <div class="hf-timeline__item" key=${it.id}>
            <div class=${`hf-timeline__dot hf-timeline__dot--${ACTIVITY_TONE[it.acao] || 'grey'}`}></div>
            <div class="hf-timeline__content">
              <div class="hf-timeline__head">
                <strong>${it.acao}</strong>
                <span class="hf-timeline__time">${new Date(it.quando).toLocaleString('pt-BR')}</span>
              </div>
              ${it.descricao && html`<p>${it.descricao}</p>`}
            </div>
          </div>
        `
      )}
    </div>
  `;
}
