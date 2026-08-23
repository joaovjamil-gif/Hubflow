# HubFlow — Arquitetura (Etapa 1)

## Stack proposta

- **Frontend:** React (Vite) + TypeScript. Sem framework CSS pesado — design system próprio (ver `design-system/tokens.css`).
- **Backend/Persistência:** Postgres via Supabase (Auth + Database + Storage + Row Level Security nativos — resolve autenticação, isolamento de dados por usuário e upload de arquivos com o mínimo de peças móveis).
- **API:** acesso direto via Supabase client no frontend para CRUD simples, com Edge Functions (Deno) para lógica de negócio sensível (ex.: conversão de orçamento → OS, cálculos financeiros).
- **Hospedagem:** Vercel/Netlify (frontend estático) + Supabase (backend gerenciado).

> Por que Supabase e não backend customizado: cobre autenticação, isolamento de dados (RLS = "usuário nunca vê dado de outro usuário" da regra 20) e storage de arquivos prontos, sem exigir manter servidor próprio. Reduz risco de segurança e tempo de construção. Se no futuro for necessário lógica de negócio mais pesada, as Edge Functions cobrem isso sem trocar de arquitetura.

## Estrutura de módulos

```
/src
  /app
    /auth            (login, cadastro, recuperação de senha)
    /dashboard
    /clientes
    /orcamentos
    /ordens-servico
    /agenda
    /financeiro
    /documentos
    /configuracoes
    /ia
  /components         (design system — botões, inputs, cards, modais, tabelas...)
  /lib
    /supabase.ts      (client)
    /api              (funções de acesso a dados por entidade)
  /styles
    /tokens.css
```

## Modelo de dados (schema — núcleo)

```sql
-- Isolamento: toda tabela tem user_id (dono do negócio) + RLS "auth.uid() = user_id"

clientes (
  id, user_id, nome, telefone, email, endereco,
  observacoes, criado_em
)

orcamentos (
  id, user_id, cliente_id, numero, data, validade,
  descricao, itens jsonb, desconto, valor_total,
  status enum('rascunho','enviado','visualizado','aprovado','recusado','expirado'),
  criado_em, atualizado_em
)

ordens_servico (
  id, user_id, cliente_id, orcamento_id (nullable),
  numero, servico, descricao, responsavel,
  data, horario, endereco, materiais jsonb, mao_de_obra,
  valor, status enum('aberta','agendada','em_andamento','aguardando','concluida','cancelada'),
  criado_em, atualizado_em
)

agenda_eventos (
  id, user_id, ordem_servico_id (nullable), titulo,
  data, hora_inicio, hora_fim, cliente_id
)
-- Regra: todo evento gerado a partir de uma OS com data/horário deve
-- referenciar ordem_servico_id, para que uma edição em um lado reflita no outro
-- (fonte única de verdade = a OS; a agenda lê a partir dela).

financeiro_lancamentos (
  id, user_id, tipo enum('receita','despesa'),
  cliente_id (nullable), ordem_servico_id (nullable), orcamento_id (nullable),
  valor, status enum('pendente','pago','atrasado'),
  vencimento, pago_em, criado_em
)

documentos (
  id, user_id, entidade_tipo enum('cliente','orcamento','ordem_servico'),
  entidade_id, nome_arquivo, storage_path, tipo, criado_em
)
```

## Fluxo crítico (ponta a ponta)

Cliente → Orçamento → Aprovação → Ordem de Serviço → Agendamento → Conclusão → Financeiro

Cada seta acima é uma referência de chave estrangeira real no schema (não duplicação de dados) — orçamento aprovado gera OS pré-preenchida; OS com data/horário gera evento de agenda; OS concluída com valor gera lançamento financeiro pendente.

## Autenticação e segurança

- Supabase Auth (e-mail/senha, recuperação de senha nativa).
- Row Level Security em toda tabela: `user_id = auth.uid()`.
- Nenhuma query no frontend confia em filtro client-side para isolamento — a segurança vive no banco (RLS), não na UI.

## Próximos passos (dependem de decisão sua)

1. Confirmar Supabase como backend (ou indicar outro, se já existir decisão tomada).
2. Quando você tiver um projeto Supabase criado, me passar a URL do projeto e a `anon key` (pública, segura para o frontend) para eu conectar a aplicação de verdade.
3. Até lá, sigo construindo a interface completa com dados mock estruturados exatamente neste schema.
