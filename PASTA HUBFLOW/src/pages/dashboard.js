// src/pages/dashboard.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, StatCard, Card, Button, Badge, statusTone } from '../components/ui.js';
import { getResumoDashboard, listAgendaDoDia, clientesApi, orcamentosApi, statusLabels } from '../services/api.js';

export function DashboardPage({ navigate }) {
  const [resumo, setResumo] = React.useState(null);
  const [agenda, setAgenda] = React.useState([]);
  const [clientesRecentes, setClientesRecentes] = React.useState([]);
  const [orcPendentes, setOrcPendentes] = React.useState([]);

  const hoje = new Date().toISOString().slice(0, 10);
  const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  React.useEffect(() => {
    getResumoDashboard().then(setResumo);
    listAgendaDoDia(hoje).then(setAgenda);
    clientesApi.list().then((c) => setClientesRecentes(c.slice(-3).reverse()));
    orcamentosApi.list().then((o) => setOrcPendentes(o.filter((x) => x.status !== 'aprovado' && x.status !== 'recusado').slice(0, 4)));
  }, []);

  const acoes = [
    { label: '+ Novo cliente', to: '/clientes' },
    { label: '+ Novo orçamento', to: '/orcamentos' },
    { label: '+ Nova OS', to: '/ordens-servico' },
    { label: '+ Novo agendamento', to: '/agenda' },
  ];

  return html`
    <div>
      <${PageHeader} eyebrow=${`Hoje, ${hojeFormatado}`} title="Painel do seu negócio" />

      <div class="hf-stats-grid">
        <${StatCard} label="A receber" value=${resumo ? `R$ ${resumo.aReceber.toLocaleString('pt-BR')}` : '—'} tone="accent" />
        <${StatCard} label="Orçamentos pendentes" value=${resumo ? resumo.orcamentosPendentes : '—'} />
        <${StatCard} label="Serviços hoje" value=${resumo ? resumo.servicosHoje : '—'} />
        <${StatCard} label="Pagamentos atrasados" value=${resumo ? resumo.pagamentosAtrasados : '—'} />
        <${StatCard} label="Clientes ativos" value=${resumo ? resumo.clientesAtivos : '—'} />
        <${StatCard} label="Orçamentos aprovados" value=${resumo ? resumo.orcamentosAprovados : '—'} />
        <${StatCard} label="Conversão em OS" value=${resumo ? `${resumo.conversaoOrcamentoParaOS}%` : '—'} />
        <${StatCard} label="OS em andamento" value=${resumo ? resumo.osEmAndamento : '—'} />
        <${StatCard} label="OS atrasadas" value=${resumo ? resumo.osAtrasadas : '—'} />
        <${StatCard} label="Receita recebida" value=${resumo ? `R$ ${resumo.receitaRecebida.toLocaleString('pt-BR')}` : '—'} />
        <${StatCard} label="Despesas pendentes" value=${resumo ? `R$ ${resumo.despesasPendentes.toLocaleString('pt-BR')}` : '—'} />
        <${StatCard} label="Contas vencidas" value=${resumo ? resumo.contasVencidas : '—'} />
      </div>

      <div style=${{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
        ${acoes.map((a) => html`<${Button} variant="ghost" onClick=${() => navigate(a.to)}>${a.label}<//>`)}
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
    </div>
  `;
}
