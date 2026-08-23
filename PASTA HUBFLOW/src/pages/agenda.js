// src/pages/agenda.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Badge, statusTone, EmptyState } from '../components/ui.js';
import { ordensServicoApi, clientesApi, statusLabels } from '../services/api.js';

export function AgendaPage() {
  const [eventos, setEventos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([ordensServicoApi.list(), clientesApi.list()]).then(([os, c]) => {
      setEventos(os.filter((o) => o.data && o.horario).sort((a, b) => a.horario.localeCompare(b.horario)));
      setClientes(c);
      setLoading(false);
    });
  }, []);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '—';

  return html`
    <div>
      <${PageHeader} eyebrow="22 de agosto de 2026" title="Agenda" />
      <p style=${{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>
        Esta lista é lida diretamente das Ordens de Serviço com data e horário definidos — não é uma cópia separada, então uma alteração na OS aparece aqui automaticamente.
      </p>
      ${!loading && eventos.length === 0
        ? html`<${EmptyState} icon="◇" title="Nada agendado" description="Compromissos aparecem aqui quando uma Ordem de Serviço recebe data e horário." />`
        : html`<div class="hf-ticket-list">
            ${eventos.map(
              (os) => html`
                <div class="hf-agenda-item">
                  <span class="hf-agenda-time">${os.horario}</span>
                  <div style=${{ flex: 1 }}>
                    <div style=${{ fontWeight: 600, fontSize: '0.9rem' }}>${os.servico}</div>
                    <div style=${{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>${nomeCliente(os.cliente_id)} · ${os.numero}</div>
                  </div>
                  <${Badge} tone=${statusTone('os', os.status)}>${statusLabels.os[os.status]}<//>
                </div>
              `
            )}
          </div>`}
    </div>
  `;
}
