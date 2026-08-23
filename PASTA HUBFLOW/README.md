# HubFlow — Etapas 1 a 4 (Arquitetura, Design System, Landing Page, Aplicação com mock)

## Como rodar

Este projeto usa ES Modules carregados direto do navegador (React via esm.sh, sem
build step, porque este ambiente de construção não tem acesso à internet para
`npm install`). Por isso os arquivos `.html` precisam ser servidos por um
servidor local — abrir com duplo clique (`file://`) pode ser bloqueado pelo
navegador para módulos ES.

Na pasta raiz do projeto:

```bash
python3 -m http.server 8000
# ou: npx serve .
```

- Landing page: `http://localhost:8000/landing/index.html`
- Aplicação (login → dashboard e módulos): `http://localhost:8000/app/index.html`

## O que está funcional agora (de verdade, não simulado)

- Navegação completa entre Login, Cadastro, Dashboard, Clientes, Orçamentos,
  Ordens de Serviço, Agenda, Financeiro, Documentos, IA e Configurações.
- CRUD real **em memória** de Clientes e Orçamentos (criar funciona, aparece na
  lista, some se você recarregar a página — isso é intencional e está
  documentado no código, não é bug).
- Fluxo ponta a ponta: aprovar um orçamento gera automaticamente uma Ordem de
  Serviço vinculada; concluir uma OS gera automaticamente um lançamento
  financeiro. Agenda é lida diretamente das OS com data/horário (não duplica
  dado).
- Design System consistente (`design-system/tokens.css`, `src/styles/app.css`)
  usado em 100% das telas.

## O que está deliberadamente honesto sobre suas limitações

- **Login/Cadastro não autenticam de verdade** — não há backend. O botão
  "Entrar" apenas navega para o dashboard, e isso está comentado no código.
- **Documentos** mostra a estrutura da tela, mas não permite upload real —
  isso exige storage de backend (Supabase Storage), inexistente aqui.
- **IA** mostra o padrão de interação (campo → geração), mas não gera texto —
  isso exige uma API de modelo de linguagem conectada via backend.
- Todo esse comportamento está para ser resolvido conectando o Supabase, como
  descrito em `docs/ARQUITETURA.md` — a interface já fala com os dados através
  de `src/services/api.js`, então plugar o backend real é trocar a
  implementação desse arquivo, não reescrever páginas.

## Estrutura

```
docs/ARQUITETURA.md        Etapa 1 — schema, stack, fluxo de dados
design-system/tokens.css   Etapa 2 — tokens de cor, tipografia, espaçamento
landing/index.html         Etapa 3 — landing page completa e funcional
src/
  data/mockData.js         Dados de exemplo, no formato exato do schema real
  services/api.js          Camada única de acesso a dados (trocar aqui = trocar tudo)
  components/ui.js         Design system em componentes React reutilizáveis
  pages/                   Uma página por módulo
  App.js                   Sidebar + roteador (hash-based)
  main.js                  Bootstrap React
app/index.html             Entry point da aplicação interna
```

## Próximos passos sugeridos

1. Criar um projeto Supabase e me passar URL + anon key para eu conectar
   `src/services/api.js` a dados reais (Fase 5 do prompt: autenticação real).
2. Depois disso: upload de documentos (Storage) e IA (Edge Function).
3. Responsividade mobile da aplicação interna (a landing já é responsiva; a
   sidebar da aplicação interna hoje se esconde em telas pequenas — precisa de
   um menu mobile antes de considerar a Fase 15 concluída).
