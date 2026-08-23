-- Infraestrutura para futuras funcionalidades de IA. Nenhuma chamada externa
-- de IA é feita nesta etapa — apenas a estrutura para registrar solicitações.

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  operation_type text not null,
  context jsonb,
  prompt text,
  response text,
  model text,
  tokens_used integer,
  estimated_cost numeric(10,4),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_ai_requests_org on public.ai_requests(organization_id);
create index idx_ai_requests_user on public.ai_requests(user_id);

alter table public.ai_requests enable row level security;
create policy ai_requests_select on public.ai_requests for select using (public.is_org_member(organization_id));
create policy ai_requests_insert on public.ai_requests for insert with check (public.is_org_member(organization_id));
create policy ai_requests_update on public.ai_requests for update using (public.is_org_member(organization_id));
