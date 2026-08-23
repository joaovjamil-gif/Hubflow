// src/pages/financeiro.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, StatCard, Table, Badge, statusTone, EmptyState, Button, Modal, Field, Input, Select, Textarea } from '../components/ui.js';
import { financeiroApi, contasPagarApi, fornecedoresApi, clientesApi, statusLabels } from '../services/api.js';

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

function statusEfetivo(lancamento, hoje) {
  if (lancamento.status === 'pendente' && lancamento.vencimento && lancamento.vencimento < hoje) return 'atrasado';
  return lancamento.status;
}

function TabButton({ ativo, onClick, children }) {
  return html`<${Button} variant=${ativo ? 'primary' : 'ghost'} onClick=${onClick}>${children}<//>`;
}

export function FinanceiroPage() {
  const [aba, setAba] = React.useState('receber');
  const [receber, setReceber] = React.useState([]);
  const [pagar, setPagar] = React.useState([]);
  const [clientes, setClientes] = React.useState([]);
  const [fornecedores, setFornecedores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState(null);
  const [erro, setErro] = React.useState('');
  const [modalPagarOpen, setModalPagarOpen] = React.useState(false);
  const [formPagar, setFormPagar] = React.useState({ fornecedor_id: '', descricao: '', categoria: '', valor: 0, vencimento: '', observacoes: '' });
  const [salvando, setSalvando] = React.useState(false);

  const hoje = new Date().toISOString().slice(0, 10);

  function reload() {
    setLoading(true);
    Promise.all([financeiroApi.list(), contasPagarApi.list(), clientesApi.list(), fornecedoresApi.list()])
      .then(([r, p, c, f]) => { setReceber(r); setPagar(p); setClientes(c); setFornecedores(f); })
      .catch((err) => setErro(err.message))
      .finally(() => setLoading(false));
  }
  React.useEffect(reload, []);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || '—';
  const nomeFornecedor = (id) => fornecedores.find((f) => f.id === id)?.nome || '—';

  function avisar(msg) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  }

  async function marcarRecebidoComoPago(l) {
    try {
      await financeiroApi.markAsPaid(l.id);
      avisar(`Lançamento de R$ ${l.valor.toFixed(2)} marcado como pago.`);
      reload();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function marcarPagoComoPago(c) {
    try {
      await contasPagarApi.markAsPaid(c.id);
      avisar(`Conta "${c.descricao}" marcada como paga.`);
      reload();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function cancelarConta(c) {
    try {
      await contasPagarApi.cancel(c.id);
      avisar(`Conta "${c.descricao}" cancelada.`);
      reload();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function salvarConta(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await contasPagarApi.create(formPagar);
      setFormPagar({ fornecedor_id: '', descricao: '', categoria: '', valor: 0, vencimento: '', observacoes: '' });
      setModalPagarOpen(false);
      reload();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  // --- Fluxo de caixa: tudo calculado a partir de receber/pagar, nada inventado ---
  const recebido = receber.filter((l) => l.status === 'pago').reduce((s, l) => s + l.valor, 0);
  const aReceber = receber.filter((l) => statusEfetivo(l, hoje) !== 'pago' && l.status !== 'cancelado').reduce((s, l) => s + l.valor, 0);
  const vencidoReceber = receber.filter((l) => statusEfetivo(l, hoje) === 'atrasado').reduce((s, l) => s + l.valor, 0);
  const pago = pagar.filter((c) => c.status === 'pago').reduce((s, c) => s + c.valor, 0);
  const aPagar = pagar.filter((c) => c.status !== 'pago' && c.status !== 'cancelado').reduce((s, c) => s + c.valor, 0);
  const vencidoPagar = pagar.filter((c) => c.status === 'pendente' && c.vencimento && c.vencimento < hoje).reduce((s, c) => s + c.valor, 0);
  const saldoRealizado = recebido - pago;
  const saldoPrevisto = saldoRealizado + aReceber - aPagar;

  return html`
    <div>
      <${PageHeader} eyebrow="Financeiro" title="Financeiro" />

      <div class="hf-stats-grid">
        <${StatCard} label="Saldo realizado" value=${`R$ ${saldoRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} tone="accent" />
        <${StatCard} label="Saldo previsto" value=${`R$ ${saldoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <${StatCard} label="A receber" value=${`R$ ${aReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <${StatCard} label="A pagar" value=${`R$ ${aPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
      </div>

      <div style=${{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <${TabButton} ativo=${aba === 'receber'} onClick=${() => setAba('receber')}>A receber<//>
        <${TabButton} ativo=${aba === 'pagar'} onClick=${() => setAba('pagar')}>A pagar<//>
        <${TabButton} ativo=${aba === 'fluxo'} onClick=${() => setAba('fluxo')}>Fluxo de caixa<//>
      </div>

      ${feedback && html`<div style=${{ background: 'rgba(51,193,122,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>✓ ${feedback}</div>`}
      ${erro && html`<div style=${{ background: 'rgba(232,80,58,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 20 }}>${erro}</div>`}

      ${aba === 'receber' && (
        !loading && receber.length === 0
          ? html`<${EmptyState} icon="◇" title="Nenhum lançamento ainda" description="Lançamentos a receber aparecem aqui automaticamente quando uma OS é concluída com valor." />`
          : html`<${Table}
              columns=${[
                { key: 'cliente', label: 'Cliente', render: (r) => nomeCliente(r.cliente_id) },
                { key: 'descricao', label: 'Descrição' },
                { key: 'valor', label: 'Valor', render: (r) => `R$ ${r.valor.toFixed(2)}` },
                { key: 'vencimento', label: 'Vencimento' },
                { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('financeiro', statusEfetivo(r, hoje))}>${statusLabels.financeiro[statusEfetivo(r, hoje)]}<//>` },
                { key: 'acao', label: '', render: (r) => (r.status === 'pendente' || r.status === 'atrasado' ? html`<${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); marcarRecebidoComoPago(r); }}>Marcar como pago<//>` : null) },
              ]}
              rows=${receber}
            />`
      )}

      ${aba === 'pagar' && html`
        <div style=${{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <${Button} variant="primary" onClick=${() => setModalPagarOpen(true)}>+ Nova conta a pagar<//>
        </div>
        ${!loading && pagar.length === 0
          ? html`<${EmptyState} icon="◇" title="Nenhuma conta a pagar ainda" description="Cadastre despesas e compromissos com fornecedores." actionLabel="Criar conta" onAction=${() => setModalPagarOpen(true)} />`
          : html`<${Table}
              columns=${[
                { key: 'fornecedor', label: 'Fornecedor', render: (r) => nomeFornecedor(r.fornecedor_id) },
                { key: 'descricao', label: 'Descrição' },
                { key: 'valor', label: 'Valor', render: (r) => `R$ ${r.valor.toFixed(2)}` },
                { key: 'vencimento', label: 'Vencimento' },
                { key: 'status', label: 'Status', render: (r) => html`<${Badge} tone=${statusTone('financeiro', r.status === 'pendente' && r.vencimento < hoje ? 'atrasado' : r.status)}>${statusLabels.financeiro[r.status === 'pendente' && r.vencimento < hoje ? 'atrasado' : r.status]}<//>` },
                {
                  key: 'acao', label: '',
                  render: (r) => (r.status === 'pendente'
                    ? html`<div style=${{ display: 'flex', gap: 8 }}>
                        <${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); marcarPagoComoPago(r); }}>Marcar como pago<//>
                        <${Button} variant="ghost" onClick=${(e) => { e.stopPropagation(); cancelarConta(r); }}>Cancelar<//>
                      </div>`
                    : null),
                },
              ]}
              rows=${pagar}
            />`}
      `}

      ${aba === 'fluxo' && html`
        <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
          <div class="hf-card">
            <h3 style=${{ marginBottom: 14 }}>Receitas</h3>
            <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
              Recebido: <strong style=${{ color: 'var(--text-primary)' }}>R$ ${recebido.toFixed(2)}</strong><br/>
              A receber: R$ ${aReceber.toFixed(2)}<br/>
              Vencido: <span style=${{ color: 'var(--danger)' }}>R$ ${vencidoReceber.toFixed(2)}</span>
            </p>
          </div>
          <div class="hf-card">
            <h3 style=${{ marginBottom: 14 }}>Despesas</h3>
            <p style=${{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
              Pago: <strong style=${{ color: 'var(--text-primary)' }}>R$ ${pago.toFixed(2)}</strong><br/>
              A pagar: R$ ${aPagar.toFixed(2)}<br/>
              Vencido: <span style=${{ color: 'var(--danger)' }}>R$ ${vencidoPagar.toFixed(2)}</span>
            </p>
          </div>
        </div>
        <p style=${{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 16 }}>
          Saldo realizado = recebido − pago. Saldo previsto = saldo realizado + a receber − a pagar (considerando tudo que ainda não venceu ou está pendente).
        </p>
      `}

      <${Modal} open=${modalPagarOpen} title="Nova conta a pagar" onClose=${() => setModalPagarOpen(false)}>
        <form onSubmit=${salvarConta} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <${Field} label="Fornecedor">
            <${Select} value=${formPagar.fornecedor_id} onChange=${(e) => setFormPagar({ ...formPagar, fornecedor_id: e.target.value })}
              options=${[{ value: '', label: 'Sem fornecedor vinculado' }, ...fornecedores.map((f) => ({ value: f.id, label: f.nome }))]} />
          <//>
          <${Field} label="Descrição"><${Input} required value=${formPagar.descricao} onChange=${(e) => setFormPagar({ ...formPagar, descricao: e.target.value })} /><//>
          <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <${Field} label="Categoria"><${Input} value=${formPagar.categoria} onChange=${(e) => setFormPagar({ ...formPagar, categoria: e.target.value })} placeholder="Ex.: Material, Aluguel..." /><//>
            <${Field} label="Valor (R$)"><${Input} type="number" min="0" step="0.01" required value=${formPagar.valor} onChange=${(e) => setFormPagar({ ...formPagar, valor: e.target.value })} /><//>
          </div>
          <${Field} label="Vencimento"><${Input} type="date" required value=${formPagar.vencimento} onChange=${(e) => setFormPagar({ ...formPagar, vencimento: e.target.value })} /><//>
          <${Field} label="Observações"><${Textarea} rows="2" value=${formPagar.observacoes} onChange=${(e) => setFormPagar({ ...formPagar, observacoes: e.target.value })} /><//>
          ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
          <${Button} type="submit" variant="primary" disabled=${salvando}>${salvando ? 'Salvando...' : 'Salvar conta'}<//>
        </form>
      <//>
    </div>
  `;
}
