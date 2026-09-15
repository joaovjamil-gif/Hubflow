# HubFlow — Backend (Supabase)

## Status

- **Fase 2 concluída**: schema completo do produto criado e aplicado no
  projeto Supabase `Hubflow` (`edjsleldeautikzccfwt`, região `sa-east-1`),
  com RLS multiempresa em todas as tabelas. Migrations versionadas em
  `supabase/migrations/` (0001 → 0013).
- **Fase 3 concluída**: autenticação real ligada. `src/services/supabaseClient.js`
  cria o client único; `src/services/auth.js` centraliza signUp/signIn/signOut/
  recuperação e atualização de senha, leitura/edição de `profiles`, e o
  bootstrap automático de organização (ver abaixo). `App.js` agora tem
  sessão persistente (`supabase.auth.getSession()` + `onAuthStateChange`) e
  proteção de rota real: usuário anônimo só acessa `/login`, `/cadastro` e
  `/nova-senha`; usuário autenticado é redirecionado para `/dashboard` se
  tentar acessar `/login`/`/cadastro`. `pages/auth.js` ganhou fluxo de
  "Esqueceu a senha?" e uma tela `NovaSenhaPage` para o link de recuperação.
  `pages/configuracoes.js` agora salva de verdade nome/telefone do usuário
  (`profiles`) e nome/telefone do negócio (`organizations`), e o botão
  "Sair da conta" desloga de verdade.

- **Fase 5 (parcial) concluída**: `clientesApi` em `src/services/api.js`
  não usa mais mock — fala direto com a tabela `customers` via
  `supabase-js`, com um mapeamento de campos (`nome`→`name`,
  `telefone`→`phone`, `endereco`→`address`, `observacoes`→`notes`) para não
  precisar tocar em `pages/clientes.js`, `dashboard.js`, `orcamentos.js` nem
  `ordensServico.js`. Exclusão é soft delete (`deleted_at`). A organização
  usada em cada chamada vem de `setCurrentOrganizationId()`, chamada pelo
  `App.js` assim que a sessão resolve `organization` — nenhuma página passa
  `organization_id` manualmente.
- Catálogo de serviços (`services`) continua só com a tabela pronta — ainda
  não existe nenhuma tela que consuma um catálogo de serviços (o formulário
  de orçamento hoje só tem descrição livre), então não há API conectada
  ainda para não construir uma camada sem uso real (ver "Pendências").

- **Fase 6 concluída**: núcleo operacional completo — Cliente → Orçamento →
  Aprovação → OS → Financeiro — conectado ao Supabase, com regras de
  negócio movidas para o banco (não para o cliente):
  - `supabase/migrations/0014_operational_core_hardening.sql`: numeração
    automática por organização (`org_sequences`/`next_sequence_value`),
    subtotal de item sempre calculado no servidor
    (`quote_items.subtotal`/`work_order_items.subtotal`, este último
    campo novo), total do orçamento sempre recalculado a partir da soma
    real dos itens (nunca um valor digitado à mão), transições de status
    validadas por trigger tanto para `quotes` quanto para `work_orders`
    (uma UPDATE para um status inválido é rejeitada pelo Postgres, não só
    escondida na UI), e histórico automático (`activity_logs`) em
    `customers`/`quotes`/`work_orders`/`accounts_receivable` via trigger
    genérico — nenhuma página precisa lembrar de registrar nada.
  - `supabase/migrations/0015_...` e `0016_...` (hardening): 4 funções de
    negócio atômicas — `create_quote`, `approve_quote`, `create_work_order`,
    `complete_work_order` — cada uma faz múltiplas escritas relacionadas
    numa única transação (orçamento + itens; orçamento aprovado + OS +
    itens copiados; OS + lançamento financeiro), sempre respeitando RLS
    (rodam como o usuário chamador, não com privilégio elevado).
  - `src/services/quotes.js`, `workOrders.js`, `financial.js`, `team.js`,
    `activity.js`: novos módulos de acesso a dados; `src/services/api.js`
    passou a reexportar `orcamentosApi`/`ordensServicoApi`/`financeiroApi`
    conectados a eles, mantendo `aprovarOrcamentoEGerarOS`/
    `concluirOSEGerarLancamento`/`listAgendaDoDia`/`getResumoDashboard`
    como as funções que atravessam módulos.
  - `pages/orcamentos.js` e `pages/ordensServico.js` foram reescritas (a
    pedido explícito, para não simplificar a OS): itens de verdade
    (adicionar/remover, com subtotal calculado pelo banco), ciclo de vida
    completo do orçamento (rascunho → enviado → aprovado/recusado/
    cancelado), OS com prioridade, responsável (selecionável entre os
    membros da organização), agendamento editável a qualquer momento,
    adição de itens durante a execução, todas as transições de status
    intermediárias como botões, conclusão com valor final/vencimento/forma
    de pagamento num modal dedicado, e um card de histórico (via
    `activity_logs`) em ambas as telas.
  - `pages/financeiro.js` conectado a `accounts_receivable` real, com
    status "atrasado" calculado no cliente a partir do vencimento (não
    depende de um job para marcar registros como atrasados), e ação de
    "Marcar como pago".
  - Corrigido também: `dashboard.js` usava uma data hardcoded
    (`'2026-08-22'`) herdada do mock para "Agenda de hoje" — agora usa a
    data real do dia.

### Limitação de validação conhecida

Não foi possível simular uma sessão real do PostgREST (`SET ROLE
authenticated` + `request.jwt.claims`) através da ferramenta de SQL desta
sessão para provar o RLS "ao vivo" como um usuário autenticado — mesmo um
teste mínimo com uma tabela nova e uma policy trivial falhou de um jeito
que não consegui diagnosticar por completo (parece uma particularidade de
como essa ferramenta executa múltiplos statements, não do schema em si).
Em vez disso, a validação desta fase combinou: (1) o fluxo de negócio
completo rodando com uma identidade real (`auth.uid()` de um usuário de
teste, membro de uma organização de teste) — que passou por todas as
funções e triggers novos sem bypass de RLS nas funções invoker; e (2) a
definição de cada policy nova conferida diretamente em `pg_policies`,
seguindo exatamente o mesmo padrão (`is_org_member`/`is_org_admin`) já
validado nas fases anteriores. Um teste manual no navegador (login real +
criar cliente/orçamento/OS) continua sendo a validação que falta e que só
dá para fazer fora deste sandbox.

## Tabelas criadas (23) + 1 bucket de Storage + 1 Edge Function

`profiles`, `organizations`, `organization_members`, `customers`,
`customer_contacts`, `services`, `quotes`, `quote_items`, `work_orders`,
`work_order_items`, `calendar_events`, `suppliers`, `financial_categories`,
`cost_centers`, `accounts_receivable`, `accounts_payable`, `transactions`,
`documents` (+ bucket `documents`), `activity_logs`, `notifications`,
`ai_requests`, `marketing_campaigns`, `marketing_contents` (Bloco 3, schema
pronto, sem UI/geração ainda). Edge Function `ai-gateway` (Bloco 3, ver
seção própria).

## Segurança (RLS)

- Toda tabela de negócio tem `organization_id` e RLS habilitado.
- Isolamento por organização via as funções `is_org_member(org_id)` e
  `is_org_admin(org_id)` (SECURITY DEFINER, evitam recursão de RLS),
  chamadas dentro de cada policy — nunca `USING (true)`.
- Exclusão (`DELETE`) geralmente restrita a `owner`/`admin` da organização;
  leitura/criação/edição liberadas para qualquer membro ativo.
- Tabelas "filhas" (itens de orçamento, itens de OS, contatos de cliente)
  herdam a checagem de organização através de um `EXISTS` na tabela pai.
- `activity_logs` é insert-only (sem policy de UPDATE/DELETE) — histórico
  não deve ser editável.
- Storage: bucket `documents` é privado; policies checam o primeiro
  segmento do caminho do arquivo (`{organization_id}/...`) contra a
  organização do usuário autenticado.
- `handle_new_user()` (cria o profile no signup) e as funções helper de RLS
  tiveram `EXECUTE` restrito — não são chamáveis livremente via RPC por
  usuários anônimos (correção aplicada em `0013_security_hardening.sql`
  após rodar o Security Advisor do Supabase).

## Divergências conscientes em relação ao mock atual

- O mock de orçamentos usa o status `aguardando`, que não existe na lista
  oficial pedida para `quotes.status` (rascunho/enviado/visualizado/
  aprovado/recusado/expirado/cancelado). O schema segue a lista oficial;
  ao migrar os dados de exemplo na Fase 5/6, esse status será normalizado
  para `enviado` ou `visualizado`, o que for mais fiel ao caso.
- Nomes de campos: o frontend usa português (`nome`, `telefone`,
  `valor_total`...), o schema usa inglês (`name`, `phone`, `total_amount`...)
  para acompanhar exatamente os nomes pedidos na especificação. A tradução
  entre os dois formatos será feita dentro de `src/services/api.js`, para
  não exigir alterar nenhuma página.

- **Bloco 2 concluído** (núcleo operacional completo): ver seção própria
  logo abaixo.

## Pendências explícitas de frontend (não implementadas ainda, por não existir tela)

- Não existe tela de criação/seleção/convite de organização. Como
  implementado na Fase 3, `getOrEnsureOrganization()` provisiona
  automaticamente uma organização pessoal (papel `owner`) no primeiro
  login de cada usuário — ponte deliberada até existir uma tela de gestão
  de organizações/membros/convites.
- `IA`: a infraestrutura é real desde o Bloco 3 (Edge Function `ai-gateway`,
  `services/aiService.js`, botão "Sugerir com IA" em Orçamentos, histórico
  de solicitações na página IA) — mas nenhum provedor de IA está conectado
  (`AI_PROVIDER_API_KEY` ausente), então toda chamada retorna
  honestamente "não configurado". Não existe assistente central em
  linguagem natural nem geração de conteúdo de marketing — só a fundação
  (ver seção Bloco 3).
- Edição de campos livres em orçamento já aprovado/OS já concluída, e
  exclusão (hard delete) de clientes/orçamentos/OS pela UI: as APIs
  suportam o necessário para o fluxo principal, mas não há botão de
  "excluir" permanente em nenhuma dessas telas — soft delete de clientes
  já existe na API (`clientesApi.remove`), só não está exposto na UI.
- Assinatura/aceite do cliente na OS: colunas preparadas
  (`work_orders.signature_url/accepted_by_name/accepted_at`), nenhuma UI —
  conforme pedido explicitamente para não implementar ainda.
- Execução da OS pelo celular: a estrutura (checklist, equipe, itens,
  anexos via `documents`) já é suficiente para isso; nenhum app/PWA mobile
  foi criado, é um bloco futuro.
- Relatórios financeiros dedicados: `transactions` já centraliza receitas e
  despesas pagas para isso, mas não há tela de relatório/exportação ainda,
  só os totais na aba "Fluxo de caixa" do Financeiro.
- `financial_categories`/`cost_centers`: tabelas prontas (Fase 2),
  `accounts_payable.category`/`transactions.category_id` ainda não usam
  uma categoria cadastrada (é texto livre na UI de contas a pagar).
- Agenda: dia/semana/mês e eventos manuais já implementados no Bloco 2 (ver
  seção própria) — o que falta é só drag-and-drop/edição de horário por
  arraste, não essencial para o uso real.

## Bloco 2 — núcleo operacional completo

Migrations 0017-0021, aplicadas nesta ordem:

- `0017_search_indexes.sql` — `pg_trgm` + índices GIN para busca por
  substring em nome/documento/número (clientes, orçamentos, OS,
  fornecedores, catálogo).
- `0018_work_order_team_checklist_signature_prep.sql` — `work_order_team`
  (mais de um responsável por OS), `work_order_checklist_items` (tarefas
  da execução, separadas dos itens cobráveis), e colunas de preparo para
  aceite/assinatura do cliente (`work_orders.signature_url`/
  `accepted_by_name`/`accepted_at` — sem UI, conforme pedido).
- `0019_financial_ledger_calendar_sync_activity.sql` — trigger que gera um
  lançamento em `transactions` sempre que uma conta a receber/pagar é
  marcada como paga (ledger único para "fluxo de caixa"); trigger que
  sincroniza automaticamente um `calendar_event` sempre que uma OS recebe
  ou perde data/horário (agendar → evento confirmado; desagendar → evento
  cancelado, não apagado; concluir → evento concluído); histórico
  automático estendido para `suppliers` e `accounts_payable`.
- `0020_move_pg_trgm_to_extensions_schema.sql` — correção de aviso do
  Security Advisor (extensão fora do schema `public`).
- `0021_service_reference_integrity.sql` — correção de uma lacuna real
  encontrada em teste: `quote_items.service_id`/`work_order_items.service_id`
  não tinham `ON DELETE SET NULL`, o que bloquearia excluir um serviço do
  catálogo referenciado por um item histórico. Não afeta o app hoje (não
  existe exclusão de serviço na UI, só desativação), mas é a integridade
  correta para quando existir.

Frontend novo/conectado nesta etapa:

- `src/services/catalog.js`, `suppliers.js`, `payables.js`, `calendar.js` —
  novas camadas de acesso a dados, seguindo o mesmo padrão de mapeamento
  português↔inglês das anteriores.
- `src/services/workOrders.js` — ganhou `listChecklist`/`addChecklistItem`/
  `toggleChecklistItem`/`removeChecklistItem` e `listTeam`/`addTeamMember`/
  `removeTeamMember`; `addItem` e a criação de OS/orçamento agora aceitam
  `servico_id` para vincular ao catálogo.
- `src/services/api.js` — `clientesApi.list` agora aceita `{search, status}`;
  novo `contatosClienteApi`, `listDocumentosDaEntidade`, `catalogoApi`,
  `fornecedoresApi`, `contasPagarApi`, `agendaCompletaApi`;
  `getResumoDashboard` ganhou 8 indicadores novos, todos calculados a
  partir do banco (nenhum número fixo).
- `pages/clientes.js` — busca, filtro por status, editar, e detalhe
  expandido: contatos (CRUD), documentos relacionados (leitura), orçamentos/
  OS/financeiro relacionados, histórico.
- `pages/servicos.js` (nova) — catálogo completo: criar, editar, ativar/
  desativar, categoria, preço, custo, margem, unidade.
- `pages/fornecedores.js` (nova) — cadastro, busca, detalhe com contas a
  pagar vinculadas e histórico.
- `pages/financeiro.js` — reescrita com abas "A receber" (já existia),
  "A pagar" (nova) e "Fluxo de caixa" (novo: saldo realizado/previsto,
  receitas/despesas, vencidos — tudo somado a partir de `accounts_receivable`
  + `accounts_payable` reais).
- `pages/agenda.js` — reescrita: visões dia/semana/mês, criação/cancelamento
  de evento manual, eventos de OS aparecem automaticamente (sincronizados
  pelo banco) e são somente cancelados pela própria OS.
- `pages/ordensServico.js` — ganhou seletor de serviço do catálogo nos
  itens (no modal de criação e no formulário rápido do detalhe), card de
  checklist (adicionar/marcar/remover tarefa) e card de equipe
  (adicionar/remover membros).
- `pages/orcamentos.js` — mesmo seletor de serviço do catálogo nos itens.
- `pages/dashboard.js` — 8 indicadores novos: clientes ativos, orçamentos
  aprovados, conversão orçamento→OS, OS em andamento, OS atrasadas, receita
  recebida, despesas pendentes, contas vencidas.
- `App.js` — navegação ganhou "Serviços" e "Fornecedores".

Corrigido de passagem: um bug real no `ClientesPage` durante a escrita
desta etapa — o modal de edição não aparecia quando acionado a partir da
tela de detalhe do cliente, porque o `return` antecipado da tela de
detalhe pulava o JSX do modal. Corrigido antes de qualquer commit (nunca
chegou a ir para o repositório quebrado).

### Validação desta etapa

Fluxo completo revalidado via SQL com uma identidade autenticada real
(mesma técnica das fases anteriores — usuário de teste + `organization_members`
+ `request.jwt.claims`), cobrindo: orçamento→OS ainda funciona após as
migrations novas; agendar/desagendar/concluir uma OS sincroniza o evento
de agenda automaticamente nos 3 estados; marcar conta a receber/pagar como
paga gera a transaction correspondente automaticamente; checklist e equipe
funcionam com RLS; histórico cobre fornecedores e contas a pagar; contato
de cliente e serviço do catálogo funcionam; a correção de FK do serviço
não quebra nada. Todos os dados de teste foram removidos ao final —
0 linhas em todas as tabelas ao terminar. `node --check` limpo em 100% dos
`.js` do frontend. Mesma limitação já registrada nas fases anteriores:
teste em navegador real não foi possível nesta sessão (rede do sandbox).

## Bloco 3 — Storage real, notificações, IA (fundação), UI/UX e gráficos (em andamento)

Migrations 0022-0025, aplicadas nesta ordem, + 1 Edge Function:

- `0022_documents_extend.sql` — `documents` ganha `category`, `description`,
  `updated_at`; `entity_type` passa a aceitar `supplier` (além de
  `customer`/`quote`/`work_order`/`profile`/`organization`/`financial`).
- `0023_notification_triggers.sql` — `create_notification()` + triggers em
  `quotes` (aprovado/recusado), `work_orders` (criada com responsável,
  atribuída, agendada, concluída) e `accounts_receivable`/`accounts_payable`
  (pago) — toda notificação nasce no banco, nunca é responsabilidade da UI
  lembrar de criar.
- `0024_daily_alerts_cron.sql` — `pg_cron` + `run_daily_alerts()` (09h
  diariamente): contas a receber/pagar vencendo em até 2 dias ou atrasadas,
  e OS atrasadas — com deduplicação por entidade+dia.
- `0025_marketing_schema_prep.sql` — `marketing_campaigns`/
  `marketing_contents`, schema + RLS prontos, sem UI/geração ainda
  (fundação, conforme pedido explícito de não avançar nos diferenciais).
- Edge Function `ai-gateway` (`supabase/functions/ai-gateway/index.ts`):
  autenticada, grava em `ai_requests` sob RLS, e responde honestamente
  `not_configured` — nenhum provedor de IA (`AI_PROVIDER_API_KEY`) está
  conectado, então nenhuma resposta de IA é inventada.

Frontend novo/conectado nesta etapa:

- `src/services/documents.js` — upload/list/signed URL/remove reais contra
  o bucket `documents`; `components/documentsPanel.js` (painel reutilizável)
  plugado em Clientes, Orçamentos, OS e Fornecedores; `pages/documentos.js`
  reescrita como navegador real de documentos da organização (antes era só
  um aviso "aguardando backend").
- `src/services/notifications.js` + `components/notificationsBell.js` —
  sino no topbar com contador, lista, marcar lida/todas lidas, link para a
  entidade; polling de 30s (reforço opcional via Realtime, best-effort).
- `src/services/aiService.js` + `aiContext.js` — único ponto de chamada de
  IA do frontend (sempre via `ai-gateway`, nunca chave de provedor no
  navegador); `pages/ia.js` reescrita para chamar o gateway de verdade e
  mostrar histórico real de solicitações; botão "Sugerir com IA" em
  Orçamentos com a mesma honestidade (mostra a mensagem real do gateway).
- `components/ui.js` — novos componentes de design system: `Dropdown`,
  `Tooltip`, `Timeline`, `Spinner`, `BarChart`, `DonutChart` (gráficos em
  CSS puro, sem lib externa). Histórico de Clientes/Orçamentos/OS/
  Fornecedores migrado para `Timeline`.
- `App.js` — menu lateral agrupado (Visão geral/Gestão/Operação/
  Financeiro/Inteligência/Sistema) e responsivo (menu hambúrguer + drawer
  abaixo de 860px, corrigindo o bug de sidebar sumir sem substituto no
  mobile).
- `pages/dashboard.js` — cards agrupados por hierarquia (Financeiro /
  Comercial e operação), gráfico de fluxo de caixa, distribuição de OS por
  status e feed de atividade recente (`listRecentActivity`, novo em
  `services/activity.js`).
- `pages/financeiro.js` — gráfico de barras de receitas x despesas na aba
  Fluxo de caixa.
- `landing/index.html` — grade de recursos atualizada para refletir os
  módulos reais atuais (Fornecedores/Documentos, Notificações), mantendo a
  IA marcada como "Em construção" (nenhuma alegação de recurso que o
  produto ainda não suporta).

### Segurança desta etapa

`get_advisors` (security) rodado após as 4 migrations novas: nenhum aviso
novo introduzido — os únicos `WARN` existentes são funções helper
pré-existentes (`is_org_member`/`is_org_admin`/`next_sequence_value`/
`user_org_role`/`rls_auto_enable`), já cobertas e aceitas nas fases
anteriores por serem apenas leitura de pertencimento, sem escalação de
privilégio. `get_advisors` (performance) mostra só `INFO` sobre FKs
`created_by` sem índice nas tabelas novas — mesmo padrão já aceito em
todo o schema (campo de auditoria, não usado em filtro).

### Testes desta etapa — validação parcial, com um problema em aberto

Reaplicada a mesma técnica de validação das fases anteriores (usuário de
teste real + `organization_members` + `request.jwt.claims` via
`set_config`), cobrindo o fluxo Cliente → Orçamento → Aprovação → OS →
Conclusão → Pagamento com as notificações novas:

- ✅ Orçamento aprovado gera notificação "Orçamento aprovado".
- ❌ **Em aberto**: a notificação "Nova OS atribuída" (trigger de INSERT em
  `work_orders`, `notify_work_order_events`) não foi confirmada na última
  rodada de teste — a asserção falhou (`count=0`) antes de a sessão ser
  interrompida para investigação. Hipótese ainda não confirmada: o
  `create_work_order`/fluxo de `approve_quote` pode não estar preenchendo
  `responsible_id` no INSERT da OS (a função só notifica quando
  `new.responsible_id is not null`), ou a RPC roda com um `auth.uid()`
  diferente do usuário de teste dentro da transação. **Não foi corrigido
  ainda** — os passos 3 e 4 do roteiro de teste (conclusão da OS e
  pagamento) não chegaram a ser reexecutados após essa falha.
- `node --check` limpo em 100% dos arquivos `.js` novos/alterados desta
  etapa (confirmado antes de cada commit).
- Teste em navegador real continua não sendo possível nesta sessão (mesma
  limitação de rede do sandbox já registrada nas fases anteriores).

**Próximo passo obrigatório antes de fechar o Bloco 3**: diagnosticar e
corrigir a falha acima, reexecutar o roteiro de teste completo (incluindo
conclusão de OS, pagamento e `run_daily_alerts()`), limpar os dados de
teste, then só então atualizar esta seção para "concluído" e escrever o
relatório final estruturado (Implementado/Banco/IA/Storage/Automação/
UI-UX/Responsividade/Segurança/Testes/Bugs corrigidos/Pendências/Próximo
passo) pedido para o fechamento deste bloco.

## Validação feita na Fase 3

- `node --check` em todos os arquivos `.js` do frontend (sintaxe válida).
- Confirmado via SQL que o trigger `on_auth_user_created` (cria o profile no
  signup) está ativo em `auth.users`.
- **Limitação do ambiente desta sessão**: a política de rede deste sandbox
  bloqueia (`403`) chamadas HTTPS diretas para `esm.sh` e para o próprio
  `*.supabase.co`, então não foi possível abrir a aplicação num navegador
  real e testar o fluxo de cadastro/login/logout ponta a ponta aqui. Isso é
  uma restrição desta sessão de trabalho, não do projeto — no ambiente do
  usuário (com internet normal), `esm.sh` e o Supabase carregam
  normalmente. Recomenda-se um teste manual rápido (`python3 -m http.server
  8000` na pasta do projeto, depois abrir `app/index.html#/cadastro`) antes
  de considerar a Fase 3 encerrada de fato.
- Corrigido, de passagem, um bug pré-existente (não relacionado ao
  Supabase, já vinha do upload original): `src/styles/app.css` importava
  `./tokens.css`, um caminho que não existe — o arquivo real é
  `design-system/tokens.css`. Sem essa correção, a aplicação interna
  carregava sem nenhum token de design (cores, tipografia, espaçamento).

## Variáveis de ambiente (Fase 3 em diante)

Sem bundler neste projeto, a URL e a `anon key` do Supabase (públicas por
design, protegidas pelo RLS) vão ficar em
`src/services/supabaseClient.js`, versionado no repositório — isso é
seguro e é o padrão recomendado pelo próprio Supabase para SPAs sem
backend próprio. A `service_role key` nunca será usada no frontend.

- `SUPABASE_URL`: `https://edjsleldeautikzccfwt.supabase.co`
- `SUPABASE_ANON_KEY`: a ser obtida via `get_publishable_keys` ao conectar
  o client na Fase 3.
