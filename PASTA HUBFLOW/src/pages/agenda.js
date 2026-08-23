// src/pages/agenda.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Badge, statusTone, EmptyState, Button, Modal, Field, Input, Select, Textarea, Card } from '../components/ui.js';
import { agendaCompletaApi, clientesApi, statusLabels } from '../services/api.js';
import { listOrganizationMembers } from '../services/team.js';

const TIPO_LABEL = { reuniao: 'Reunião', visita: 'Visita', servico: 'Serviço', lembrete: 'Lembrete', outro: 'Outro' };

function inicioDoDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function inicioDaSemana(d) { const x = inicioDoDia(d); const dow = x.getDay(); return addDias(x, -dow); }
function inicioDoMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function fimDoMes(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }
const fmtISO = (d) => d.toISOString();
const fmtHora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDiaLabel = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const FORM_VAZIO = { titulo: '', tipo: 'reuniao', cliente_id: '', responsavel_id: '', local: '', data: '', horaInicio: '', horaFim: '', descricao: '' };

export function AgendaPage({ organization }) {
  const [visualizacao, setVisualizacao] = React.useState('semana');
  const [dataRef, setDataRef] = React.useState(new Date());
  const [eventos, setEventos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [membros, setMembros] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState(FORM_VAZIO);
  const [salvando, setSalvando] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null);

  const range = React.useMemo(() => {
    if (visualizacao === 'dia') return [inicioDoDia(dataRef), addDias(inicioDoDia(dataRef), 1)];
    if (visualizacao === 'semana') return [inicioDaSemana(dataRef), addDias(inicioDaSemana(dataRef), 7)];
    return [inicioDoMes(dataRef), fimDoMes(dataRef)];
  }, [visualizacao, dataRef]);

  function reload() {
    setLoading(true);
    Promise.all([agendaCompletaApi.listRange(fmtISO(range[0]), fmtISO(range[1])), clientesApi.list()])
      .then(([ev, c]) => { setEventos(ev); setClientes(c); })
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, [range[0].getTime(), range[1].getTime()]);
  React.useEffect(() => {
    if (organization?.id) listOrganizationMembers(organization.id).then(setMembros).catch(() => setMembros([]));
  }, [organization?.id]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '';
  const nomeMembro = (id) => membros.find((m) => m.id === id)?.nome || '';

  function avisar(msg) { setFeedback(msg); setTimeout(() => setFeedback(null), 4000); }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const inicio = new Date(`${form.data}T${form.horaInicio || '00:00'}`).toISOString();
      const fim = form.horaFim ? new Date(`${form.data}T${form.horaFim}`).toISOString() : null;
      await agendaCompletaApi.create({
        titulo: form.titulo, tipo: form.tipo, cliente_id: form.cliente_id || null,
        responsavel_id: form.responsavel_id || null, local: form.local, descricao: form.descricao,
        inicio, fim, dia_inteiro: !form.horaInicio,
      });
      setForm(FORM_VAZIO);
      setModalOpen(false);
      reload();
    } catch (err) {
      setErro(err.message || 'Erro ao criar evento.');
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarEvento(ev) {
    try {
      await agendaCompletaApi.cancel(ev.id);
      avisar(`Evento "${ev.titulo}" cancelado.`);
      reload();
    } catch (err) {
      setErro(err.message);
    }
  }

  function EventoItem({ ev }) {
    return html`
      <div class="hf-agenda-item">
        <span class="hf-agenda-time">${ev.dia_inteiro ? '—' : fmtHora(ev.inicio)}</span>
        <div style=${{ flex: 1 }}>
          <div style=${{ fontWeight: 600, fontSize: '0.9rem' }}>${ev.titulo}</div>
          <div style=${{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            ${TIPO_LABEL[ev.tipo] || ev.tipo}${ev.cliente_id ? ` · ${nomeCliente(ev.cliente_id)}` : ''}${ev.responsavel_id ? ` · ${nomeMembro(ev.responsavel_id)}` : ''}${ev.local ? ` · ${ev.local}` : ''}
            ${ev.ordem_servico_id ? html` · <em>originado de OS</em>` : ''}
          </div>
        </div>
        <${Badge} tone=${statusTone('agenda', ev.status)}>${statusLabels.agenda[ev.status] || ev.status}<//>
        ${!ev.ordem_servico_id && ev.status !== 'cancelado' && html`<${Button} variant="ghost" onClick=${() => cancelarEvento(ev)} style=${{ marginLeft: 8 }}>Cancelar<//>`}
      </div>
    `;
  }

  return html`
    <div>
      <${PageHeader} eyebrow="Agenda" title="Agenda" action=${html`<${Button} variant="primary" onClick=${() => setModalOpen(true)}>+ Novo evento<//>`} />

      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style=${{ display: 'flex', gap: 8 }}>
          <${Button} variant="ghost" onClick=${() => setDataRef(addDias(dataRef, visualizacao === 'mes' ? -30 : visualizacao === 'semana' ? -7 : -1))}>← Anterior<//>
          <${Button} variant="ghost" onClick=${() => setDataRef(new Date())}>Hoje<//>
          <${Button} variant="ghost" onClick=${() => setDataRef(addDias(dataRef, visualizacao === 'mes' ? 30 : visualizacao === 'semana' ? 7 : 1))}>Próxima →<//>
        </div>
        <div style=${{ display: 'flex', gap: 8 }}>
          ${['dia', 'semana', 'mes'].map((v) => html`<${Button} key=${v} variant=${visualizacao === v ? 'primary' : 'ghost'} onClick=${() => setVisualizacao(v)}>${v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}<//>`)}
        </div>
      </div>

      ${feedback && html`<div style=${{ background: 'rgba(51,193,122,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>✓ ${feedback}</div>`}
      ${erro && html`<div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>${erro}</div>`}

      ${!loading && eventos.length === 0
        ? html`<${EmptyState} icon="◇" title="Nada agendado neste período" description="Eventos aparecem aqui manualmente ou automaticamente quando uma OS recebe data e horário." />`
        : visualizacao === 'mes'
        ? html`<${VisaoMes} range=${range} eventos=${eventos} onDiaClick=${(d) => { setDataRef(d); setVisualizacao('dia'); }} />`
        : html`<div class="hf-ticket-list">${eventos.map((ev) => html`<${EventoItem} key=${ev.id} ev=${ev} />`)}</div>`}

      <${Modal} open=${modalOpen} title="Novo evento" onClose=${() => setModalOpen(false)}>
        <form onSubmit=${salvar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Título"><${Input} required value=${form.titulo} onChange=${(e) => setForm({ ...form, titulo: e.target.value })} /><//>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="Tipo">
              <${Select} value=${form.tipo} onChange=${(e) => setForm({ ...form, tipo: e.target.value })} options=${Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))} />
            <//>
            <${Field} label="Cliente (opcional)">
              <${Select} value=${form.cliente_id} onChange=${(e) => setForm({ ...form, cliente_id: e.target.value })}
                options=${[{ value: '', label: 'Nenhum' }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]} />
            <//>
          </div>
          <${Field} label="Responsável">
            <${Select} value=${form.responsavel_id} onChange=${(e) => setForm({ ...form, responsavel_id: e.target.value })}
              options=${[{ value: '', label: 'A definir' }, ...membros.map((m) => ({ value: m.id, label: m.nome }))]} />
          <//>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <${Field} label="Data"><${Input} type="date" required value=${form.data} onChange=${(e) => setForm({ ...form, data: e.target.value })} /><//>
            <${Field} label="Início"><${Input} type="time" value=${form.horaInicio} onChange=${(e) => setForm({ ...form, horaInicio: e.target.value })} /><//>
            <${Field} label="Fim"><${Input} type="time" value=${form.horaFim} onChange=${(e) => setForm({ ...form, horaFim: e.target.value })} /><//>
          </div>
          <${Field} label="Local"><${Input} value=${form.local} onChange=${(e) => setForm({ ...form, local: e.target.value })} /><//>
          <${Field} label="Descrição"><${Textarea} rows="2" value=${form.descricao} onChange=${(e) => setForm({ ...form, descricao: e.target.value })} /><//>
          ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
          <${Button} type="submit" variant="primary" disabled=${salvando}>${salvando ? 'Salvando...' : 'Criar evento'}<//>
        </form>
      <//>
    </div>
  `;
}

function VisaoMes({ range, eventos, onDiaClick }) {
  const inicio = inicioDaSemana(range[0]);
  const dias = [];
  for (let d = inicio; d < range[1] || dias.length % 7 !== 0; d = addDias(d, 1)) {
    dias.push(d);
    if (dias.length > 41) break;
  }
  const porDia = {};
  eventos.forEach((ev) => {
    const chave = new Date(ev.inicio).toDateString();
    (porDia[chave] = porDia[chave] || []).push(ev);
  });

  return html`
    <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      ${dias.map((d) => {
        const doMes = d.getMonth() === range[0].getMonth();
        const evDoDia = porDia[d.toDateString()] || [];
        return html`
          <div key=${d.toISOString()} onClick=${() => onDiaClick(d)} class="hf-card" style=${{ padding: 10, minHeight: 84, cursor: 'pointer', opacity: doMes ? 1 : 0.4 }}>
            <div style=${{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>${fmtDiaLabel(d)}</div>
            ${evDoDia.slice(0, 3).map((ev) => html`<div key=${ev.id} style=${{ fontSize: '0.72rem', color: 'var(--accent)', marginBottom: 2 }}>● ${ev.titulo}</div>`)}
            ${evDoDia.length > 3 && html`<div style=${{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>+${evDoDia.length - 3}</div>`}
          </div>
        `;
      })}
    </div>
  `;
}
