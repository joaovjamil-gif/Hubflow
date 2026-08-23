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

## Tabelas criadas (21) + 1 bucket de Storage

`profiles`, `organizations`, `organization_members`, `customers`,
`customer_contacts`, `services`, `quotes`, `quote_items`, `work_orders`,
`work_order_items`, `calendar_events`, `suppliers`, `financial_categories`,
`cost_centers`, `accounts_receivable`, `accounts_payable`, `transactions`,
`documents` (+ bucket `documents`), `activity_logs`, `notifications`,
`ai_requests`.

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

## Pendências explícitas de frontend (não implementadas ainda, por não existir tela)

- Não existe tela de criação/seleção/convite de organização. Como
  implementado na Fase 3, `getOrEnsureOrganization()` provisiona
  automaticamente uma organização pessoal (papel `owner`) no primeiro
  login de cada usuário — ponte deliberada até existir uma tela de gestão
  de organizações/membros/convites.
- `Documentos`: schema e bucket prontos, mas a página não tem UI de upload
  — só existe hoje um aviso informativo (Fase 7).
- `IA`: tabela `ai_requests` pronta para registrar solicitações, mas
  nenhuma chamada externa de IA foi implementada (Fase 9, e apenas
  mediante decisão explícita de qual modelo/API usar).
- Edição de campos livres em orçamento/OS já aprovados (ex.: mudar a
  descrição de um orçamento depois de criado, editar um item já salvo em
  vez de só adicionar/remover) e exclusão (hard/soft delete) de clientes,
  orçamentos e OS pela UI: as APIs já suportam o necessário para o fluxo
  principal (criar, mudar status, adicionar item), mas não há botão de
  "editar" genérico nem de "excluir" em nenhuma dessas três telas ainda.
- Catálogo de serviços (`services`): continua sem UI — o seletor de item em
  Orçamento/OS é texto livre, não busca de um catálogo pré-cadastrado.
- Fornecedores (`suppliers`) e contas a pagar (`accounts_payable`): schema
  pronto (Fase 2), nenhuma tela ainda.
- Visualização de agenda por dia/semana/mês: o schema de `calendar_events`
  (`starts_at`, `ends_at`, `all_day`) já suporta, mas a página `agenda.js`
  ainda deriva a lista diretamente das OS agendadas, sem usar
  `calendar_events` nem oferecer essas visualizações (Fase 8).

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
