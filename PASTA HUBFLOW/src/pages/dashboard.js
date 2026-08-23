// src/pages/dashboard.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, StatCard, Card, Button, Badge, statusTone, BarChart, DonutChart, Timeline, Spinner } from '../components/ui.js';
import { getResumoDashboard, listAgendaDoDia, clientesApi, orcamentosApi, statusLabels } from '../services/api.js';
import { listRecentActivity } from '../services/activity.js';

const OS_STATUS_COLORS = {
  aberta: '#67666E',
  agendada: '#E8B339',
  em_andamento: '#FF5A1F',
  aguardando: '#E8B339',
  concluida: '#33C17A',
  cancelada: '#E8503A',
};

function moeda(v) {
  return `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export function DashboardPage({ navigate, organization }) {
  const [resumo, setResumo] = React.useState(null);
  const [agenda, setAgenda] = React.useState([]);
  const [clientesRecentes, setClientesRecentes] = React.useState([]);
  const [orcPendentes, setOrcPendentes] = React.useState([]);
  const [atividade, setAtividade] = React.useState([]);
  const [carregandoAtividade, setCarregandoAtividade] = React.useState(true);

  const hoje = new Date().toISOString().slice(0, 10);
  const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  React.useEffect(() => {
    getResumoDashboard().then(setResumo);
    listAgendaDoDia(hoje).then(setAgenda);
    clientesApi.list().then((c) => setClientesRecentes(c.slice(-3).reverse()));
    orcamentosApi.list().then((o) => setOrcPendentes(o.filter((x) => x.status !== 'aprovado' && x.status !== 'recusado').slice(0, 4)));
    if (organization?.id) {
      listRecentActivity(organization.id, 10).then(setAtividade).catch(() => {}).finally(() => setCarregandoAtividade(false));
    }
  }, [organization?.id]);

  const acoes = [
    { label: '+ Novo cliente', to: '/clientes' },
    { label: '+ Novo orçamento', to: '/orcamentos' },
    { label: '+ Nova OS', to: '/ordens-servico' },
    { label: '+ Novo agendamento', to: '/agenda' },
  ];

  const osSegmentos = resumo
    ? Object.entries(resumo.osPorStatus || {}).map(([status, valor]) => ({
        label: statusLabels.os[status] || status,
        value: valor,
        color: OS_STATUS_COLORS[status] || '#67666E',
      }))
    : [];

  const fluxoBarras = resumo
    ? [
        { label: 'Recebido', value: resumo.receitaRecebida, color: '#33C17A' },
        { label: 'A receber', value: resumo.receitaPrevista, color: '#E8B339' },
        { label: 'Pago', value: resumo.despesasPagas, color: '#FF5A1F' },
        { label: 'A pagar', value: resumo.despesasPendentes, color: '#E8503A' },
      ]
    : [];

  return html`
    <div>
      <${PageHeader} eyebrow=${`Hoje, ${hojeFormatado}`} title="Painel do seu negócio" />

      <div style=${{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        ${acoes.map((a) => html`<${Button} variant="ghost" onClick=${() => navigate(a.to)}>${a.label}<//>`)}
      </div>

      <div class="hf-kicker" style=${{ marginBottom: 10 }}>Financeiro</div>
      <div class="hf-stats-grid">
        <${StatCard} label="Saldo previsto" value=${resumo ? moeda(resumo.receitaRecebida + resumo.receitaPrevista - resumo.despesasPagas - resumo.despesasPendentes) : '—'} tone="accent" />
        <${StatCard} label="A receber" value=${resumo ? moeda(resumo.aReceber) : '—'} />
        <${StatCard} label="Receita recebida" value=${resumo ? moeda(resumo.receitaRecebida) : '—'} />
        <${StatCard} label="Despesas pendentes" value=${resumo ? moeda(resumo.despesasPendentes) : '—'} />
        <${StatCard} label="Contas vencidas" value=${resumo ? resumo.contasVencidas : '—'} />
      </div>

      <div class="hf-kicker" style=${{ marginBottom: 10 }}>Comercial e operação</div>
      <div class="hf-stats-grid">
        <${StatCard} label="Clientes ativos" value=${resumo ? resumo.clientesAtivos : '—'} />
        <${StatCard} label="Orçamentos pendentes" value=${resumo ? resumo.orcamentosPendentes : '—'} />
        <${StatCard} label="Orçamentos aprovados" value=${resumo ? resumo.orcamentosAprovados : '—'} />
        <${StatCard} label="Conversão em OS" value=${resumo ? `${resumo.conversaoOrcamentoParaOS}%` : '—'} />
        <${StatCard} label="Serviços hoje" value=${resumo ? resumo.servicosHoje : '—'} />
        <${StatCard} label="OS em andamento" value=${resumo ? resumo.osEmAndamento : '—'} />
        <${StatCard} label="OS atrasadas" value=${resumo ? resumo.osAtrasadas : '—'} />
      </div>

      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Fluxo de caixa</h3>
          ${resumo ? html`<${BarChart} data=${fluxoBarras} formatValue=${moeda} height=${170} />` : html`<${Spinner} />`}
        <//>
        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Ordens de serviço por status</h3>
          ${resumo ? html`<${DonutChart} segments=${osSegmentos} />` : html`<${Spinner} />`}
        <//>
      </div>

      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1.2fr 1fr' }}>
        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Agenda de hoje</h3>
          ${agenda.length === 0
            ? html`<p style=${{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Nada agendado para hoje.</p>`
            : html`<div class="hf-ticket-list">
                ${agenda.map(
                  (os) => html`
                    <div class="hf-agenda-item">
                      <span class="hf-agenda-time">${os.horario}</span>
                      <div style=${{ flex: 1 }}>
                        <div style=${{ fontWeight: 600, fontSize: '0.9rem' }}>${os.servico}</div>
                        <div style=${{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>${os.numero}</div>
                      </div>
                      <${Badge} tone=${statusTone('os', os.status)}>${statusLabels.os[os.status]}<//>
                    </div>
                  `
                )}
              </div>`}
        <//>

        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Orçamentos pendentes</h3>
          ${orcPendentes.length === 0
            ? html`<p style=${{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Nenhum orçamento pendente.</p>`
            : orcPendentes.map(
                (o) => html`
                  <div key=${o.id} style=${{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.88rem' }}>
                    <span>${o.numero} — R$ ${o.valor_total}</span>
                    <${Badge} tone=${statusTone('orcamento', o.status)}>${statusLabels.orcamento[o.status]}<//>
                  </div>
                `
              )}
        <//>
      </div>

      <div style=${{ marginTop: 20 }}>
        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Atividade recente</h3>
          ${carregandoAtividade
            ? html`<${Spinner} />`
            : atividade.length === 0
            ? html`<p style=${{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Nenhuma atividade registrada ainda.</p>`
            : html`
                <div class="hf-activity-feed">
                  ${atividade.map(
                    (a) => html`
                      <div class="hf-activity-item" key=${a.id}>
                        <span class="hf-activity-item__tag">${a.entidade}</span>
                        <span class="hf-activity-item__body"><strong>${a.acao}</strong> — ${a.descricao}</span>
                        <span class="hf-activity-item__time">${new Date(a.quando).toLocaleString('pt-BR')}</span>
                      </div>
                    `
                  )}
                </div>
              `}
        <//>
      </div>
    </div>
  `;
}
