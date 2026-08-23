# HubFlow — Backend (Supabase)

## Status

Fase 2 concluída: schema completo do produto criado e aplicado no projeto
Supabase `Hubflow` (`edjsleldeautikzccfwt`, região `sa-east-1`), com RLS
multiempresa em todas as tabelas. As migrations estão versionadas em
`supabase/migrations/` e foram aplicadas na ordem numérica (0001 → 0013).

O frontend **ainda não foi conectado** a este banco — os mocks em
`src/data/mockData.js` e `src/services/api.js` continuam ativos. Isso é
proposital: conectar autenticação/dados reais é a Fase 3 em diante.

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

- Não existe tela de criação/seleção de organização. Ao conectar a
  autenticação real (Fase 3), a primeira sessão de cada usuário vai
  provisionar automaticamente uma organização pessoal (papel `owner`) como
  ponte, até existir uma tela de gestão de organizações/convites.
- `Documentos`: schema e bucket prontos, mas a página não tem UI de upload
  — só existe hoje um aviso informativo (Fase 7).
- `IA`: tabela `ai_requests` pronta para registrar solicitações, mas
  nenhuma chamada externa de IA foi implementada (Fase 9, e apenas
  mediante decisão explícita de qual modelo/API usar).
- `Configurações`: o formulário de perfil do negócio não salva nada hoje;
  vai passar a gravar em `organizations` quando a Fase 5 conectar essa
  página.
- Edição/exclusão de clientes, orçamentos e OS: a API (Fase 5+) já vai
  oferecer `update`/soft-delete, mas a UI atual só tem "criar" e "listar" —
  os botões de editar/excluir precisarão ser adicionados às páginas quando
  isso for priorizado.
- Visualização de agenda por dia/semana/mês: o schema (`starts_at`,
  `ends_at`, `all_day`) já suporta, a página `agenda.js` hoje é só uma lista.

## Variáveis de ambiente (Fase 3 em diante)

Sem bundler neste projeto, a URL e a `anon key` do Supabase (públicas por
design, protegidas pelo RLS) vão ficar em
`src/services/supabaseClient.js`, versionado no repositório — isso é
seguro e é o padrão recomendado pelo próprio Supabase para SPAs sem
backend próprio. A `service_role key` nunca será usada no frontend.

- `SUPABASE_URL`: `https://edjsleldeautikzccfwt.supabase.co`
- `SUPABASE_ANON_KEY`: a ser obtida via `get_publishable_keys` ao conectar
  o client na Fase 3.
