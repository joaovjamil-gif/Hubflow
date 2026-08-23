// src/pages/orcamentos.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Button, Table, Badge, statusTone, EmptyState, Field, Input, Textarea, Select, Modal, Card } from '../components/ui.js';
import { orcamentosApi, clientesApi, aprovarOrcamentoEGerarOS, statusLabels } from '../services/api.js';
import { listActivity } from '../services/activity.js';

const ITEM_VAZIO = { descricao: '', quantidade: 1, unidade: 'un', preco_unitario: 0, desconto: 0 };

function calcularSubtotalItens(itens) {
  return itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0) - (Number(it.desconto) || 0), 0);
}

function ItemsEditor({ itens, setItens }) {
  function atualizar(i, campo, valor) {
    const novo = [...itens];
    novo[i] = { ...novo[i], [campo]: valor };
    setItens(novo);
  }
  function remover(i) {
    setItens(itens.filter((_, idx) => idx !== i));
  }
  const subtotal = calcularSubtotalItens(itens);

  return html`
    <div>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Itens do orçamento</span>
        <${Button} variant="ghost" type="button" onClick=${() => setItens([...itens, { ...ITEM_VAZIO }])}>+ Item<//>
      </div>
      ${itens.length === 0
        ? html`<p style=${{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>Nenhum item ainda — adicione ao menos um.</p>`
        : html`<div style=${{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            ${itens.map(
              (it, i) => html`
                <div style=${{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 1fr 0.7fr auto', gap: 8, alignItems: 'end' }}>
                  <${Field} label="Descrição"><${Input} required value=${it.descricao} onChange=${(e) => atualizar(i, 'descricao', e.target.value)} /><//>
                  <${Field} label="Qtd"><${Input} type="number" min="0" step="1" value=${it.quantidade} onChange=${(e) => atualizar(i, 'quantidade', e.target.value)} /><//>
                  <${Field} label="Preço unit. (R$)"><${Input} type="number" min="0" step="0.01" value=${it.preco_unitario} onChange=${(e) => atualizar(i, 'preco_unitario', e.target.value)} /><//>
                  <${Field} label="Desc. (R$)"><${Input} type="number" min="0" step="0.01" value=${it.desconto} onChange=${(e) => atualizar(i, 'desconto', e.target.value)} /><//>
                  <button type="button" onClick=${() => remover(i)} class="hf-btn hf-btn--ghost" style=${{ padding: '9px 10px' }}>✕</button>
                </div>
              `
            )}
          </div>`}
      <div style=${{ marginTop: 10, textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Subtotal dos itens: <strong style=${{ color: 'var(--text-primary)' }}>R$ ${subtotal.toFixed(2)}</strong>
      </div>
    </div>
  `;
}

export function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [feedback, setFeedback] = React.useState(null);
  const [selecionado, setSelecionado] = React.useState(null);

  const [form, setForm] = React.useState({ cliente_id: '', titulo: '', descricao: '', validade: '', desconto: 0, impostos: 0, observacoes: '', condicoes_pagamento: '' });
  const [itens, setItens] = React.useState([{ ...ITEM_VAZIO }]);

  function reload() {
    setLoading(true);
    Promise.all([orcamentosApi.list(), clientesApi.list()])
      .then(([o, c]) => { setOrcamentos(o); setClientes(c); })
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, []);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '—';

  function avisar(msg) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await orcamentosApi.create(form, itens);
      setForm({ cliente_id: '', titulo: '', descricao: '', validade: '', desconto: 0, impostos: 0, observacoes: '', condicoes_pagamento: '' });
      setItens([{ ...ITEM_VAZIO }]);
      setModalOpen(false);
      reload();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar orçamento.');
    } finally {
      setSalvando(false);
    }
  }

  async function marcarComoEnviado(orc) {
    try {
      await orcamentosApi.updateStatus(orc.id, 'enviado');
      avisar(`Orçamento ${orc.numero} marcado como enviado.`);
      reload();
    } catch (err) {
      avisar(`Erro: ${err.message}`);
    }
  }

  async function aprovar(orc) {
    try {
      const { ordemServico } = await aprovarOrcamentoEGerarOS(orc.id);
      avisar(`Orçamento ${orc.numero} aprovado — ${ordemServico.numero} criada automaticamente.`);
      reload();
    } catch (err) {
      avisar(`Erro: ${err.message}`);
    }
  }

  async function recusar(orc) {
    try {
      await orcamentosApi.updateStatus(orc.id, 'recusado');
      avisar(`Orçamento ${orc.numero} marcado como recusado.`);
      reload();
      setSelecionado(null);
    } catch (err) {
      avisar(`Erro: ${err.message}`);
    }
  }

  async function cancelar(orc) {
    try {
      await orcamentosApi.updateStatus(orc.id, 'cancelado');
      avisar(`Orçamento ${orc.numero} cancelado.`);
      reload();
      setSelecionado(null);
    } catch (err) {
      avisar(`Erro: ${err.message}`);
    }
  }

  function acaoRapida(r) {
    if (r.status === 'rascunho') return html`<${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); marcarComoEnviado(r); }}>Marcar como enviado<//>`;
    if (r.status === 'enviado' || r.status === 'visualizado') return html`<${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); aprovar(r); }}>Aprovar → gerar OS<//>`;
    if (r.status === 'aprovado') return html`<span style=${{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>OS gerada</span>`;
    return null;
  }

  if (selecionado) {
    return html`<${OrcamentoDetalhe}
      orcamento=${selecionado}
      nomeCliente=${nomeCliente(selecionado.cliente_id)}
      onVoltar=${() => setSelecionado(null)}
      onMarcarEnviado=${() => marcarComoEnviado(selecionado).then(() => setSelecionado(null))}
      onAprovar=${() => aprovar(selecionado).then(() => setSelecionado(null))}
      onRecusar=${() => recusar(selecionado)}
      onCancelar=${() => cancelar(selecionado)}
    />`;
  }

  return html`
    <div>
      <${PageHeader}
        eyebrow="Orçamentos"
        title="Orçamentos"
        action=${html`<${Button} variant="primary" onClick=${() => setModalOpen(true)}>+ Novo orçamento<//>`}
      />

      ${feedback && html`
        <div style=${{ background: 'rgba(51,193,122,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>
          ${feedback}
        </div>
      `}
      ${erro && html`
        <div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>
          ${erro}
        </div>
      `}

      ${!loading && orcamentos.length === 0
        ? html`<${EmptyState}
            icon="◇"
            title="Nenhum orçamento ainda"
            description="Crie seu primeiro orçamento e comece a organizar seus serviços."
            actionLabel="Criar orçamento"
            onAction=${() => setModalOpen(true)}
          />`
        : html`<${Table}
            columns=${[
              { key: 'numero', label: 'Número' },
              { key: 'cliente', label: 'Cliente', render: (r) => nomeCliente(r.cliente_id) },
              { key: 'valor_total', label: 'Valor', render: (r) => `R$ ${r.valor_total.toFixed(2)}` },
              { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('orcamento', r.status)}>${statusLabels.orcamento[r.status] || r.status}<//>` },
              { key: 'acao', label: '', render: acaoRapida },
            ]}
            rows=${orcamentos}
            onRowClick=${setSelecionado}
          />`}

      <${Modal} open=${modalOpen} title="Novo orçamento" onClose=${() => setModalOpen(false)}>
        <form onSubmit=${salvar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Cliente">
            <${Select}
              required
              value=${form.cliente_id}
              onChange=${(e) => setForm({ ...form, cliente_id: e.target.value })}
              options=${[{ value: '', label: 'Selecione...' }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
            />
          <//>
          <${Field} label="Título"><${Input} value=${form.titulo} onChange=${(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Instalação elétrica" /><//>
          <${Field} label="Descrição do serviço"><${Textarea} rows="2" value=${form.descricao} onChange=${(e) => setForm({ ...form, descricao: e.target.value })} /><//>

          <${ItemsEditor} itens=${itens} setItens=${setItens} />

          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="Desconto total (R$)"><${Input} type="number" min="0" step="0.01" value=${form.desconto} onChange=${(e) => setForm({ ...form, desconto: e.target.value })} /><//>
            <${Field} label="Impostos (R$)"><${Input} type="number" min="0" step="0.01" value=${form.impostos} onChange=${(e) => setForm({ ...form, impostos: e.target.value })} /><//>
          </div>
          <${Field} label="Validade"><${Input} type="date" value=${form.validade} onChange=${(e) => setForm({ ...form, validade: e.target.value })} /><//>
          <${Field} label="Condições de pagamento"><${Input} value=${form.condicoes_pagamento} onChange=${(e) => setForm({ ...form, condicoes_pagamento: e.target.value })} placeholder="Ex.: 50% adiantado, 50% na entrega" /><//>
          <${Field} label="Observações"><${Textarea} rows="2" value=${form.observacoes} onChange=${(e) => setForm({ ...form, observacoes: e.target.value })} /><//>

          ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
          <${Button} type="submit" variant="primary" disabled=${salvando}>${salvando ? 'Salvando...' : 'Salvar como rascunho'}<//>
        </form>
      <//>
    </div>
  `;
}

function OrcamentoDetalhe({ orcamento, nomeCliente, onVoltar, onMarcarEnviado, onAprovar, onRecusar, onCancelar }) {
  const [itens, setItens] = React.useState([]);
  const [historico, setHistorico] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    setCarregando(true);
    Promise.all([
      orcamentosApi.listItems(orcamento.id),
      listActivity('quotes', orcamento.id),
    ])
      .then(([its, hist]) => { setItens(its); setHistorico(hist); })
      .finally(() => setCarregando(false));
  }, [orcamento.id]);

  const podeEnviar = orcamento.status === 'rascunho';
  const podeAprovar = orcamento.status === 'enviado' || orcamento.status === 'visualizado';
  const podeCancelar = !['aprovado', 'cancelado'].includes(orcamento.status);

  return html`
    <div>
      <button onClick=${onVoltar} class="hf-btn hf-btn--ghost" style=${{ marginBottom: 20 }}>← Voltar</button>
      <${PageHeader}
        eyebrow=${orcamento.numero}
        title=${orcamento.titulo || orcamento.descricao || 'Orçamento'}
        action=${html`
          <div style=${{ display: 'flex', gap: 8 }}>
            ${podeEnviar && html`<${Button} variant="ghost" onClick=${onMarcarEnviado}>Marcar como enviado<//>`}
            ${podeAprovar && html`<${Button} variant="ghost" onClick=${onRecusar}>Recusar<//>`}
            ${podeAprovar && html`<${Button} variant="primary" onClick=${onAprovar}>Aprovar → gerar OS<//>`}
            ${podeCancelar && html`<${Button} variant="danger" onClick=${onCancelar}>Cancelar<//>`}
          </div>
        `}
      />

      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1.3fr 1fr' }}>
        <div style=${{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <${Card}>
            <div style=${{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3>Itens</h3>
              <${Badge} tone=${statusTone('orcamento', orcamento.status)}>${orcamento.status}<//>
            </div>
            ${carregando
              ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Carregando...</p>`
              : html`<${Table}
                  columns=${[
                    { key: 'descricao', label: 'Descrição' },
                    { key: 'quantidade', label: 'Qtd' },
                    { key: 'preco_unitario', label: 'Preço unit.', render: (r) => `R$ ${r.preco_unitario.toFixed(2)}` },
                    { key: 'subtotal', label: 'Subtotal', render: (r) => `R$ ${r.subtotal.toFixed(2)}` },
                  ]}
                  rows=${itens}
                  emptyLabel="Nenhum item cadastrado."
                />`}
            <div style=${{ marginTop: 16, borderTop: '1px solid var(--border-soft)', paddingTop: 12, fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style=${{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>R$ ${orcamento.subtotal.toFixed(2)}</span></div>
              <div style=${{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}><span>Desconto</span><span>- R$ ${orcamento.desconto.toFixed(2)}</span></div>
              <div style=${{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}><span>Impostos</span><span>+ R$ ${orcamento.impostos.toFixed(2)}</span></div>
              <div style=${{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', marginTop: 4 }}><span>Total</span><span>R$ ${orcamento.valor_total.toFixed(2)}</span></div>
            </div>
          <//>

          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Histórico</h3>
            ${historico.length === 0
              ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Sem eventos ainda.</p>`
              : html`<div style=${{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  ${historico.map(
                    (h) => html`
                      <div key=${h.id} style=${{ fontSize: '0.85rem', borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
                        <strong>${h.acao}</strong> — ${h.descricao}
                        <div style=${{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>${new Date(h.quando).toLocaleString('pt-BR')}</div>
                      </div>
                    `
                  )}
                </div>`}
          <//>
        </div>

        <div style=${{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Cliente</h3>
            <p style=${{ fontSize: '0.9rem' }}>${nomeCliente}</p>
          <//>
          <${Card}>
            <h3 style=${{ marginBottom: 12 }}>Detalhes</h3>
            <p style=${{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
              Validade: ${orcamento.validade || '—'}<br/>
              Condições de pagamento: ${orcamento.condicoes_pagamento || '—'}<br/>
              Observações: ${orcamento.observacoes || '—'}<br/>
              Criado em: ${orcamento.criado_em}
            </p>
          <//>
        </div>
      </div>
    </div>
  `;
}
