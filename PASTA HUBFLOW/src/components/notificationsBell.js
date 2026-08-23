// src/components/notificationsBell.js
//
// Sino de notificações do topbar. Lê `notifications` (ver
// services/notifications.js) — todas geradas automaticamente pelo banco
// (orçamento aprovado, OS atribuída/agendada/concluída, pagamento
// confirmado, alertas diários de vencimento). Atualiza por polling (30s,
// confiável mesmo sem Realtime habilitado na tabela) e também tenta uma
// assinatura em tempo real como reforço best-effort.
import React from 'https://esm.sh/react@18';
import { html, Dropdown } from './ui.js';
import { notificacoesApi } from '../services/api.js';
import { notificationsApi, routeForNotification } from '../services/notifications.js';

const POLL_MS = 30000;

function tempoRelativo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export function NotificationsBell({ organization, navigate }) {
  const [open, setOpen] = React.useState(false);
  const [itens, setItens] = React.useState([]);
  const [naoLidas, setNaoLidas] = React.useState(0);
  const [carregando, setCarregando] = React.useState(false);

  function carregarContador() {
    if (!organization?.id) return;
    notificacoesApi.unreadCount().then(setNaoLidas).catch(() => {});
  }

  function carregarLista() {
    if (!organization?.id) return;
    setCarregando(true);
    notificacoesApi.list({ limit: 20 })
      .then(setItens)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  React.useEffect(() => {
    carregarContador();
    const interval = setInterval(carregarContador, POLL_MS);
    let unsubscribe = () => {};
    if (organization?.id) {
      unsubscribe = notificationsApi.subscribe(organization.id, () => carregarContador());
    }
    return () => { clearInterval(interval); unsubscribe(); };
  }, [organization?.id]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) carregarLista();
  }

  async function abrirNotificacao(n) {
    if (!n.lida) {
      await notificacoesApi.markRead(n.id).catch(() => {});
      setItens((prev) => prev.map((it) => (it.id === n.id ? { ...it, lida: true } : it)));
      setNaoLidas((c) => Math.max(0, c - 1));
    }
    const rota = routeForNotification(n.entidadeTipo);
    if (rota && navigate) navigate(rota);
    setOpen(false);
  }

  async function marcarTodasLidas() {
    await notificacoesApi.markAllRead().catch(() => {});
    setItens((prev) => prev.map((it) => ({ ...it, lida: true })));
    setNaoLidas(0);
  }

  return html`
    <div class="hf-dropdown-wrap">
      <button class="hf-bell" onClick=${toggle} aria-label="Notificações">
        🔔
        ${naoLidas > 0 && html`<span class="hf-bell__count">${naoLidas > 99 ? '99+' : naoLidas}</span>`}
      </button>
      <${Dropdown} open=${open} onClose=${() => setOpen(false)} align="right">
        <div class="hf-notif-panel">
          <div class="hf-notif-panel__head">
            <h4>Notificações</h4>
            ${naoLidas > 0 && html`<button class="hf-btn hf-btn--ghost" style=${{ padding: '4px 10px', fontSize: '0.72rem' }} onClick=${marcarTodasLidas}>Marcar todas como lidas</button>`}
          </div>
          <div class="hf-notif-panel__list">
            ${carregando
              ? html`<div class="hf-notif-empty">Carregando...</div>`
              : itens.length === 0
              ? html`<div class="hf-notif-empty">Nenhuma notificação por aqui ainda.</div>`
              : itens.map(
                  (n) => html`
                    <div key=${n.id} class=${`hf-notif-item ${!n.lida ? 'is-unread' : ''}`} onClick=${() => abrirNotificacao(n)}>
                      <span class=${`hf-notif-item__dot hf-notif-item__dot--${n.tipo}`}></span>
                      <div style=${{ flex: 1, minWidth: 0 }}>
                        <div class="hf-notif-item__title">${n.titulo}</div>
                        ${n.mensagem && html`<div class="hf-notif-item__msg">${n.mensagem}</div>`}
                        <div class="hf-notif-item__time">${tempoRelativo(n.criadoEm)}</div>
                      </div>
                    </div>
                  `
                )}
          </div>
        </div>
      <//>
    </div>
  `;
}
