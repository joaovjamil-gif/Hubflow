// src/pages/ia.js
//
// Central de Inteligência Artificial da HubFlow. A infraestrutura é real:
// toda chamada aqui passa pela Edge Function `ai-gateway` (autenticada,
// grava em ai_requests sob RLS). O que ainda não existe é um provedor de IA
// conectado (AI_PROVIDER_API_KEY) — então cada chamada retorna, honestamente,
// "não configurado" em vez de qualquer texto inventado. Quando um provedor
// for conectado, é só configurar a variável de ambiente da função; nada
// aqui muda.
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Card, Field, Textarea, Button, Badge, Spinner } from '../components/ui.js';
import { aiService, AI_OPERATIONS } from '../services/aiService.js';
import { buildQuoteContext } from '../services/aiContext.js';

const STATUS_LABEL = { pending: 'Pendente', completed: 'Concluída', failed: 'Sem provedor / falhou' };
const STATUS_TONE = { pending: 'yellow', completed: 'green', failed: 'grey' };

function ResultadoIA({ resultado }) {
  if (!resultado) return null;
  if (resultado.status === 'not_configured') {
    return html`
      <div style=${{ marginTop: 18, padding: 14, border: '1px dashed var(--border)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        ${resultado.message}
      </div>
    `;
  }
  return html`
    <div style=${{ marginTop: 18, padding: 14, border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
      Resposta do gateway: <strong>${resultado.status}</strong> (solicitação ${resultado.request_id?.slice(0, 8)})
    </div>
  `;
}

export function IAPage({ organization }) {
  const [entrada, setEntrada] = React.useState('');
  const [gerando, setGerando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const [erro, setErro] = React.useState('');
  const [historico, setHistorico] = React.useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = React.useState(true);

  function carregarHistorico() {
    if (!organization?.id) return;
    setCarregandoHistorico(true);
    aiService.listRequests(organization.id).then(setHistorico).catch(() => {}).finally(() => setCarregandoHistorico(false));
  }
  React.useEffect(carregarHistorico, [organization?.id]);

  async function gerar(e) {
    e.preventDefault();
    setErro('');
    setResultado(null);
    setGerando(true);
    try {
      const resp = await aiService.request(organization.id, AI_OPERATIONS.QUOTE_DESCRIPTION, {
        context: buildQuoteContext({ titulo: entrada, descricao: entrada, valor_total: 0 }),
        prompt: entrada,
      });
      setResultado(resp);
      carregarHistorico();
    } catch (err) {
      setErro(err.message || 'Erro ao chamar a IA.');
    } finally {
      setGerando(false);
    }
  }

  return html`
    <div>
      <${PageHeader} eyebrow="Fundação" title="Inteligência Artificial" />

      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1.3fr 1fr' }}>
        <${Card}>
          <h3 style=${{ marginBottom: 6 }}>Gerar descrição de serviço</h3>
          <p style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 18 }}>
            Descreva o serviço em poucas palavras. Esta chamada é real — passa pela Edge Function
            <code>ai-gateway</code>, autenticada e registrada em <code>ai_requests</code> — mas nenhum provedor
            de IA está conectado ainda, então a resposta hoje é honestamente "não configurado", não um texto
            inventado.
          </p>
          <form onSubmit=${gerar} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <${Field} label="Descreva o serviço">
              <${Textarea} rows="3" required value=${entrada} onChange=${(e) => setEntrada(e.target.value)} placeholder="Ex.: Instalação de ar-condicionado de 12.000 BTUs" />
            <//>
            ${erro && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erro}</p>`}
            <${Button} type="submit" variant="primary" disabled=${gerando}>${gerando ? 'Consultando IA...' : 'Consultar IA'}<//>
          </form>
          <${ResultadoIA} resultado=${resultado} />
        <//>

        <${Card}>
          <h3 style=${{ marginBottom: 12 }}>Histórico de solicitações</h3>
          ${carregandoHistorico
            ? html`<${Spinner} />`
            : historico.length === 0
            ? html`<p style=${{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Nenhuma solicitação de IA feita ainda.</p>`
            : html`
                <div style=${{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  ${historico.map(
                    (h) => html`
                      <div key=${h.id} style=${{ fontSize: '0.82rem', borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
                        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>${h.tipo}</span>
                          <${Badge} tone=${STATUS_TONE[h.status] || 'grey'}>${STATUS_LABEL[h.status] || h.status}<//>
                        </div>
                        <div style=${{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: 2 }}>${new Date(h.criadoEm).toLocaleString('pt-BR')}</div>
                      </div>
                    `
                  )}
                </div>
              `}
        <//>
      </div>

      <${Card} style=${{ marginTop: 20 }}>
        <h3 style=${{ marginBottom: 8 }}>Arquitetura</h3>
        <p style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          Frontend → <code>services/aiService.js</code> → Edge Function <code>ai-gateway</code> (autenticada,
          nunca expõe chave de provedor) → tabela <code>ai_requests</code> (auditoria, sob RLS por organização).
          Quando um provedor de IA for conectado (via variável de ambiente <code>AI_PROVIDER_API_KEY</code> na
          função), as mesmas chamadas passam a retornar respostas reais — nenhuma página precisa mudar.
          Um assistente central por linguagem natural sobre os dados da organização e a geração de conteúdo
          de marketing (schema já preparado em <code>marketing_campaigns</code>/<code>marketing_contents</code>)
          seguem essa mesma arquitetura quando forem além da fundação.
        </p>
      <//>
    </div>
  `;
}
