// src/pages/ordensServico.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Table, Badge, statusTone, EmptyState, Card, Button, Modal, Field, Input, Select, Textarea, Timeline } from '../components/ui.js';
import { ordensServicoApi, clientesApi, catalogoApi, concluirOSEGerarLancamento, statusLabels } from '../services/api.js';
import { listActivity } from '../services/activity.js';
import { listOrganizationMembers } from '../services/team.js';
import { DocumentsPanel } from '../components/documentsPanel.js';

const PRIORIDADE_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
const PRIORIDADE_TONE = { baixa: 'grey', media: 'yellow', alta: 'orange', urgente: 'red' };
const FORMA_PAGAMENTO_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
];

// Transições simples (sem efeito colateral) que a UI oferece como botão
// direto. "Concluir" e "Cancelar" são tratados à parte, iguais em qualquer
// status ativo — este mapa espelha enforce_work_order_status_transition no
// banco (supabase/migrations/0014_...), que é quem realmente decide.
const PROXIMOS_STATUS = {
  aberta: ['agendada', 'em_andamento', 'aguardando'],
  agendada: ['em_andamento', 'aguardando'],
  em_andamento: ['aguardando'],
  aguardando: ['em_andamento'],
};
const STATUS_ATIVOS = ['aberta', 'agendada', 'em_andamento', 'aguardando'];

const ITEM_VAZIO = { servico_id: '', descricao: '', quantidade: 1, preco_unitario: 0 };

function ItemsEditor({ itens, setItens, catalogo = [] }) {
  function atualizar(i, campo, valor) {
    const novo = [...itens];
    novo[i] = { ...novo[i], [campo]: valor };
    setItens(novo);
  }
  function escolherServico(i, servicoId) {
    const servico = catalogo.find((s) => s.id === servicoId);
    const novo = [...itens];
    novo[i] = servico
      ? { ...novo[i], servico_id: servico.id, descricao: servico.nome, preco_unitario: servico.preco_padrao }
      : { ...novo[i], servico_id: '' };
    setItens(novo);
  }
  return html`
    <div>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Itens / serviços</span>
        <${Button} variant="ghost" type="button" onClick=${() => setItens([...itens, { ...ITEM_VAZIO }])}>+ Item<//>
      </div>
      ${itens.map(
        (it, i) => html`
          <div style=${{ border: '1px solid var(--border-soft)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            ${catalogo.length > 0 && html`
              <${Select}
                value=${it.servico_id}
                onChange=${(e) => escolherServico(i, e.target.value)}
                options=${[{ value: '', label: 'Descrição livre (sem vincular ao catálogo)' }, ...catalogo.map((s) => ({ value: s.id, label: `${s.nome} — R$ ${s.preco_padrao.toFixed(2)}` }))]}
                style=${{ marginBottom: 8 }}
              />
            `}
            <div style=${{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 1fr auto', gap: 8 }}>
              <${Input} placeholder="Descrição" required value=${it.descricao} onChange=${(e) => atualizar(i, 'descricao', e.target.value)} />
              <${Input} type="number" min="0" step="1" placeholder="Qtd" value=${it.quantidade} onChange=${(e) => atualizar(i, 'quantidade', e.target.value)} />
              <${Input} type="number" min="0" step="0.01" placeholder="Preço unit." value=${it.preco_unitario} onChange=${(e) => atualizar(i, 'preco_unitario', e.target.value)} />
              <button type="button" onClick=${() => setItens(itens.filter((_, idx) => idx !== i))} class="hf-btn hf-btn--ghost">✕</button>
            </div>
          </div>
        `
      )}
    </div>
  `;
}

export function OrdensServicoPage({ organization }) {
  const [os, setOs] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [catalogo, setCatalogo] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selecionada, setSelecionada] = React.useState(null);
  const [feedback, setFeedback] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [membros, setMembros] = React.useState([]);

  const [form, setForm] = React.useState({
    cliente_id: '', titulo: '', descricao: '', prioridade: 'media',
    data_prevista: '', hora_prevista: '', endereco: '', valor_estimado: 0, responsavel_id: '',
  });
  const [itens, setItens] = React.useState([]);

  function reload() {
    setLoading(true);
    Promise.all([ordensServicoApi.list(), clientesApi.list(), catalogoApi.list({ onlyActive: true })])
      .then(([o, c, cat]) => { setOs(o); setClientes(c); setCatalogo(cat); })
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, []);
  React.useEffect(() => {
    if (organization?.id) listOrganizationMembers(organization.id).then(setMembros).catch(() => setMembros([]));
  }, [organization?.id]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '—';

  function avisar(msg) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 5000);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await ordensServicoApi.create(form, itens);
      setForm({ cliente_id: '', titulo: '', descricao: '', prioridade: 'media', data_prevista: '', hora_prevista: '', endereco: '', valor_estimado: 0, responsavel_id: '' });
      setItens([]);
      setModalOpen(false);
      reload();
    } catch (err) {
      setErro(err.message || 'Erro ao criar OS.');
    } finally {
      setSalvando(false);
    }
  }

  return html`
    <div>
      <${PageHeader}
        eyebrow="Operação"
        title="Ordens de Serviço"
        action=${html`<${Button} variant="primary" onClick=${() => setModalOpen(true)}>+ Nova OS<//>`}
      />
      ${feedback && html`
        <div style=${{ background: 'rgba(51,193,122,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>
          ${feedback}
        </div>
      `}
      ${selecionada
        ? html`<${OsDetalhe}
            os=${selecionada}
            nomeCliente=${nomeCliente(selecionada.cliente_id)}
            membros=${membros}
            catalogo=${catalogo}
            onVoltar=${() => { setSelecionada(null); reload(); }}
            onAvisar=${avisar}
          />`
        : loading
        ? null
        : os.length === 0
        ? html`<${EmptyState} icon="◇" title="Nenhuma OS ainda" description="Ordens de serviço aparecem aqui quando um orçamento é aprovado, ou você pode criar diretamente com '+ Nova OS'." />`
        : html`<${Table}
            columns=${[
              { key: 'numero', label: 'Número' },
              { key: 'servico', label: 'Serviço' },
              { key: 'cliente', label: 'Cliente', render: (r) => nomeCliente(r.cliente_id) },
              { key: 'prioridade', label: 'Prioridade', render: (r) => html`<${Badge} tone=${PRIORIDADE_TONE[r.prioridade] || 'grey'}>${PRIORIDADE_LABEL[r.prioridade] || r.prioridade}<//>` },
              { key: 'data', label: 'Previsão', render: (r) => (r.data ? `${r.data} ${r.horario || ''}` : 'A definir') },
              { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('os', r.status)}>${statusLabels.os[r.status]}<//>` },
            ]}
            rows=${os}
            onRowClick=${setSelecionada}
          />`}

      <${Modal} open=${modalOpen} title="Nova Ordem de Serviço" onClose=${() => setModalOpen(false)}>
        <form onSubmit=${salvar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Cliente">
            <${Select} required value=${form.cliente_id} onChange=${(e) => setForm({ ...form, cliente_id: e.target.value })}
              options=${[{ value: '', label: 'Selecione...' }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]} />
          <//>
          <${Field} label="Título / serviço"><${Input} required value=${form.titulo} onChange=${(e) => setForm({ ...form, titulo: e.target.value })} /><//>
          <${Field} label="Descrição"><${Textarea} rows="2" value=${form.descricao} onChange=${(e) => setForm({ ...form, descricao: e.target.value })} /><//>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="Prioridade">
              <${Select} value=${form.prioridade} onChange=${(e) => setForm({ ...form, prioridade: e.target.value })}
                options=${Object.entries(PRIORIDADE_LABEL).map(([value, label]) => ({ value, label }))} />
            <//>
            <${Field} label="Responsável">
              <${Select} value=${form.responsavel_id} onChange=${(e) => setForm({ ...form, responsavel_id: e.target.value })}
                options=${[{ value: '', label: 'A definir' }, ...membros.map((m) => ({ value: m.id, label: m.nome }))]} />
            <//>
          </div>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="Data prevista"><${Input} type="date" value=${form.data_prevista} onChange=${(e) => setForm({ ...form, data_prevista: e.target.value })} /><//>
            <${Field} label="Horário previsto"><${Input} type="time" value=${form.hora_prevista} onChange=${(e) => setForm({ ...form, hora_prevista: e.target.value })} /><//>
          </div>
          <${Field} label="Endereço de execução"><${Input} value=${form.endereco} onChange=${(e) => setForm({ ...form, endereco: e.target.value })} /><//>
          <${Field} label="Valor estimado (R$)"><${Input} type="number" min="0" step="0.01" value=${form.valor_estimado} onChange=${(e) => setForm({ ...form, valor_estimado: e.target.value })} /><//>
          <${ItemsEditor} itens=${itens} setItens=${setItens} catalogo=${catalogo} />
          ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
          <${Button} type="submit" variant="primary" disabled=${salvando}>${salvando ? 'Criando...' : 'Criar OS'}<//>
        </form>
      <//>
    </div>
  `;
}

function OsDetalhe({ os, nomeCliente, membros, catalogo = [], onVoltar, onAvisar }) {
  const [atual, setAtual] = React.useState(os);
  const [itens, setItens] = React.useState([]);
  const [historico, setHistorico] = React.useState([]);
  const [checklist, setChecklist] = React.useState([]);
  const [equipe, setEquipe] = React.useState([]);
  const [novoChecklist, setNovoChecklist] = React.useState('');
  const [novoMembroEquipe, setNovoMembroEquipe] = React.useState('');
  const [novoItem, setNovoItem] = React.useState({ servico_id: '', descricao: '', quantidade: 1, preco_unitario: 0 });
  const [concluirOpen, setConcluirOpen] = React.useState(false);
  const [concluirForm, setConcluirForm] = React.useState({ valorFinal: os.valor_estimado, vencimento: '', formaPagamento: '' });
  const [processando, setProcessando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [agendamento, setAgendamento] = React.useState({
    data_prevista: os.data_prevista || '',
    hora_prevista: os.hora_prevista || '',
    responsavel_id: os.responsavel_id || '',
  });
  const [salvandoAgendamento, setSalvandoAgendamento] = React.useState(false);

  function carregar() {
    Promise.all([
      ordensServicoApi.get(atual.id),
      ordensServicoApi.listItems(atual.id),
      listActivity('work_orders', atual.id),
      ordensServicoApi.listChecklist(atual.id),
      ordensServicoApi.listTeam(atual.id),
    ]).then(([wo, its, hist, check, time]) => {
      if (wo) setAtual(wo);
      setItens(its);
      setHistorico(hist);
      setChecklist(check);
      setEquipe(time);
    });
  }
  React.useEffect(carregar, [atual.id]);

  async function adicionarChecklist(e) {
    e.preventDefault();
    if (!novoChecklist.trim()) return;
    try {
      await ordensServicoApi.addChecklistItem(atual.id, novoChecklist.trim());
      setNovoChecklist('');
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }
  async function alternarChecklist(item) {
    try {
      await ordensServicoApi.toggleChecklistItem(item.id, !item.feito);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }
  async function removerChecklist(id) {
    try {
      await ordensServicoApi.removeChecklistItem(id);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function adicionarNaEquipe(e) {
    e.preventDefault();
    if (!novoMembroEquipe) return;
    try {
      await ordensServicoApi.addTeamMember(atual.id, novoMembroEquipe);
      setNovoMembroEquipe('');
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }
  async function removerDaEquipe(id) {
    try {
      await ordensServicoApi.removeTeamMember(id);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function mudarStatus(novoStatus, extra) {
    setErro('');
    setProcessando(true);
    try {
      const atualizado = await ordensServicoApi.updateStatus(atual.id, novoStatus, extra);
      setAtual(atualizado);
      onAvisar(`${atualizado.numero} agora está "${novoStatus}".`);
      carregar();
    } catch (err) {
      setErro(err.message || 'Erro ao atualizar status.');
    } finally {
      setProcessando(false);
    }
  }

  async function cancelar() {
    await mudarStatus('cancelada');
  }

  async function salvarAgendamento(e) {
    e.preventDefault();
    setErro('');
    setSalvandoAgendamento(true);
    try {
      const atualizado = await ordensServicoApi.updateStatus(atual.id, atual.status, agendamento);
      setAtual(atualizado);
      onAvisar(`Agendamento de ${atualizado.numero} atualizado.`);
      carregar();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar agendamento.');
    } finally {
      setSalvandoAgendamento(false);
    }
  }

  async function adicionarItem(e) {
    e.preventDefault();
    if (!novoItem.descricao) return;
    try {
      await ordensServicoApi.addItem(atual.id, novoItem);
      setNovoItem({ servico_id: '', descricao: '', quantidade: 1, preco_unitario: 0 });
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }
  function escolherServicoNovoItem(servicoId) {
    const servico = catalogo.find((s) => s.id === servicoId);
    setNovoItem(servico ? { servico_id: servico.id, descricao: servico.nome, quantidade: 1, preco_unitario: servico.preco_padrao } : { ...novoItem, servico_id: '' });
  }

  async function concluir(e) {
    e.preventDefault();
    setErro('');
    setProcessando(true);
    try {
      const { ordemServico, lancamento } = await concluirOSEGerarLancamento(atual.id, concluirForm);
      setAtual(ordemServico);
      setConcluirOpen(false);
      onAvisar(
        lancamento
          ? `${ordemServico.numero} concluída — lançamento financeiro de R$ ${Number(lancamento.amount).toFixed(2)} gerado.`
          : `${ordemServico.numero} concluída — sem valor, nenhum lançamento financeiro foi gerado.`
      );
      carregar();
    } catch (err) {
      setErro(err.message || 'Erro ao concluir a OS.');
    } finally {
      setProcessando(false);
    }
  }

  const ativa = STATUS_ATIVOS.includes(atual.status);
  const proximos = PROXIMOS_STATUS[atual.status] || [];

  return html`
    <div>
      <button onClick=${onVoltar} class="hf-btn hf-btn--ghost" style=${{ marginBottom: 20 }}>← Voltar</button>
      <${PageHeader}
        eyebrow=${atual.numero}
        title=${atual.titulo || atual.servico}
        action=${html`
          <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            ${ativa && proximos.map((s) => html`<${Button} key=${s} variant="ghost" disabled=${processando} onClick=${() => mudarStatus(s)}>Mover para "${statusLabels.os[s]}"<//>`)}
            ${ativa && html`<${Button} variant="primary" disabled=${processando} onClick=${() => setConcluirOpen(true)}>Marcar como concluída<//>`}
            ${ativa && html`<${Button} variant="danger" disabled=${processando} onClick=${cancelar}>Cancelar OS<//>`}
          </div>
        `}
      />

      ${erro && html`<div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>${erro}</div>`}
      ${atual.orcamento_id && html`<p style=${{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: 16 }}>Originada automaticamente de um orçamento aprovado.</p>`}

      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1.3fr 1fr' }}>
        <div style=${{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Itens / serviços</h3>
            <${Table}
              columns=${[
                { key: 'descricao', label: 'Descrição' },
                { key: 'quantidade', label: 'Qtd' },
                { key: 'preco_unitario', label: 'Preço unit.', render: (r) => `R$ ${r.preco_unitario.toFixed(2)}` },
                { key: 'subtotal', label: 'Subtotal', render: (r) => `R$ ${r.subtotal.toFixed(2)}` },
              ]}
              rows=${itens}
              emptyLabel="Nenhum item ainda."
            />
            ${ativa && html`
              <form onSubmit=${adicionarItem} style=${{ marginTop: 14 }}>
                ${catalogo.length > 0 && html`
                  <${Select}
                    value=${novoItem.servico_id}
                    onChange=${(e) => escolherServicoNovoItem(e.target.value)}
                    options=${[{ value: '', label: 'Descrição livre (sem vincular ao catálogo)' }, ...catalogo.map((s) => ({ value: s.id, label: `${s.nome} — R$ ${s.preco_padrao.toFixed(2)}` }))]}
                    style=${{ marginBottom: 8 }}
                  />
                `}
                <div style=${{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 1fr auto', gap: 8 }}>
                  <${Input} placeholder="Descrição do item/material" value=${novoItem.descricao} onChange=${(e) => setNovoItem({ ...novoItem, descricao: e.target.value })} />
                  <${Input} type="number" min="0" step="1" value=${novoItem.quantidade} onChange=${(e) => setNovoItem({ ...novoItem, quantidade: e.target.value })} />
                  <${Input} type="number" min="0" step="0.01" value=${novoItem.preco_unitario} onChange=${(e) => setNovoItem({ ...novoItem, preco_unitario: e.target.value })} />
                  <${Button} type="submit" variant="ghost">+ Adicionar<//>
                </div>
              </form>
            `}
          <//>

          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Checklist de execução</h3>
            ${checklist.length === 0
              ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Nenhuma tarefa ainda.</p>`
              : html`<div style=${{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  ${checklist.map((it) => html`
                    <label key=${it.id} style=${{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', padding: '4px 0' }}>
                      <input type="checkbox" checked=${it.feito} disabled=${!ativa} onChange=${() => alternarChecklist(it)} />
                      <span style=${{ flex: 1, textDecoration: it.feito ? 'line-through' : 'none', color: it.feito ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>${it.descricao}</span>
                      ${ativa && html`<button type="button" onClick=${() => removerChecklist(it.id)} class="hf-btn hf-btn--ghost" style=${{ padding: '2px 8px', fontSize: '0.75rem' }}>✕</button>`}
                    </label>
                  `)}
                </div>`}
            ${ativa && html`
              <form onSubmit=${adicionarChecklist} style=${{ display: 'flex', gap: 8, marginTop: 10 }}>
                <${Input} placeholder="Nova tarefa (ex.: Testar disjuntor)" value=${novoChecklist} onChange=${(e) => setNovoChecklist(e.target.value)} />
                <${Button} type="submit" variant="ghost">+<//>
              </form>
            `}
          <//>

          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Equipe</h3>
            ${equipe.length === 0
              ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Só o responsável principal está definido.</p>`
              : equipe.map((m) => html`
                  <div key=${m.id} style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                    <span>${m.nome}${m.funcao ? ` — ${m.funcao}` : ''}</span>
                    ${ativa && html`<button onClick=${() => removerDaEquipe(m.id)} class="hf-btn hf-btn--ghost" style=${{ padding: '4px 8px', fontSize: '0.75rem' }}>Remover</button>`}
                  </div>
                `)}
            ${ativa && html`
              <form onSubmit=${adicionarNaEquipe} style=${{ display: 'flex', gap: 8, marginTop: 10 }}>
                <${Select} value=${novoMembroEquipe} onChange=${(e) => setNovoMembroEquipe(e.target.value)}
                  options=${[{ value: '', label: 'Selecione um membro...' }, ...membros.map((m) => ({ value: m.id, label: m.nome }))]} />
                <${Button} type="submit" variant="ghost">+<//>
              </form>
            `}
          <//>

          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Histórico</h3>
            <${Timeline} items=${historico} emptyLabel="Sem eventos ainda." />
          <//>
        </div>

        <div style=${{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Detalhes</h3>
            <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
              Cliente: ${nomeCliente}<br/>
              Prioridade: <${Badge} tone=${PRIORIDADE_TONE[atual.prioridade] || 'grey'}>${PRIORIDADE_LABEL[atual.prioridade] || atual.prioridade}<//><br/>
              Endereço: ${atual.endereco || '—'}<br/>
              Aberta em: ${atual.data_abertura || '—'}<br/>
              ${atual.data_conclusao ? html`Concluída em: ${new Date(atual.data_conclusao).toLocaleString('pt-BR')}<br/>` : ''}
            </p>
          <//>

          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Agendamento e responsável</h3>
            ${ativa
              ? html`
                  <form onSubmit=${salvarAgendamento} style=${{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <${Field} label="Data prevista"><${Input} type="date" value=${agendamento.data_prevista} onChange=${(e) => setAgendamento({ ...agendamento, data_prevista: e.target.value })} /><//>
                      <${Field} label="Horário"><${Input} type="time" value=${agendamento.hora_prevista} onChange=${(e) => setAgendamento({ ...agendamento, hora_prevista: e.target.value })} /><//>
                    </div>
                    <${Field} label="Responsável">
                      <${Select} value=${agendamento.responsavel_id} onChange=${(e) => setAgendamento({ ...agendamento, responsavel_id: e.target.value })}
                        options=${[{ value: '', label: 'A definir' }, ...membros.map((m) => ({ value: m.id, label: m.nome }))]} />
                    <//>
                    <${Button} type="submit" variant="ghost" disabled=${salvandoAgendamento}>${salvandoAgendamento ? 'Salvando...' : 'Salvar agendamento'}<//>
                  </form>
                `
              : html`
                  <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                    Responsável: ${nomeMembroSeguro(membros, atual.responsavel_id)}<br/>
                    Data prevista: ${atual.data_prevista || '—'} ${atual.hora_prevista || ''}
                  </p>
                `}
          <//>
          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Valores</h3>
            <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
              Estimado: R$ ${atual.valor_estimado.toFixed(2)}<br/>
              Final: ${atual.valor_final !== null ? `R$ ${atual.valor_final.toFixed(2)}` : '—'}
            </p>
          <//>
          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Status</h3>
            <${Badge} tone=${statusTone('os', atual.status)}>${statusLabels.os[atual.status]}<//>
            <p style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 14 }}>${atual.descricao}</p>
          <//>
          <${DocumentsPanel} entityType="work_order" entityId=${atual.id} />
        </div>
      </div>

      <${Modal} open=${concluirOpen} title="Concluir Ordem de Serviço" onClose=${() => setConcluirOpen(false)}>
        <form onSubmit=${concluir} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Valor final (R$)">
            <${Input} type="number" min="0" step="0.01" value=${concluirForm.valorFinal} onChange=${(e) => setConcluirForm({ ...concluirForm, valorFinal: e.target.value })} />
          <//>
          <${Field} label="Vencimento do recebimento">
            <${Input} type="date" value=${concluirForm.vencimento} onChange=${(e) => setConcluirForm({ ...concluirForm, vencimento: e.target.value })} />
          <//>
          <${Field} label="Forma de pagamento">
            <${Select} value=${concluirForm.formaPagamento} onChange=${(e) => setConcluirForm({ ...concluirForm, formaPagamento: e.target.value })} options=${FORMA_PAGAMENTO_OPTIONS} />
          <//>
          <p style=${{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Se o valor final for maior que zero, um lançamento financeiro pendente é gerado automaticamente.</p>
          ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
          <${Button} type="submit" variant="primary" disabled=${processando}>${processando ? 'Concluindo...' : 'Concluir e gerar financeiro'}<//>
        </form>
      <//>
    </div>
  `;
}

function nomeMembroSeguro(membros, id) {
  if (!id) return 'A definir';
  return membros.find((m) => m.id === id)?.nome || 'A definir';
}
