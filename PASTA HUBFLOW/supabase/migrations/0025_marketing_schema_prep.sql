-- Estrutura do módulo "Marketing com IA" (preparo, sem UI/geração ainda —
-- ver docs/BACKEND.md). Campos conforme especificação: objetivo, público,
-- canais, conteúdos, status, métricas.
create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  objective text,
  target_audience text,
  channels text[] not null default '{}',
  status text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'pausada', 'concluida', 'cancelada')),
  start_date date,
  end_date date,
  budget numeric(12,2),
  metrics jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_marketing_campaigns_updated_at before update on public.marketing_campaigns
for each row execute function public.set_updated_at();

create index idx_marketing_campaigns_org on public.marketing_campaigns(organization_id);

alter table public.marketing_campaigns enable row level security;
create policy marketing_campaigns_select on public.marketing_campaigns for select using (public.is_org_member(organization_id));
create policy marketing_campaigns_insert on public.marketing_campaigns for insert with check (public.is_org_member(organization_id));
create policy marketing_campaigns_update on public.marketing_campaigns for update using (public.is_org_member(organization_id));
create policy marketing_campaigns_delete on public.marketing_campaigns for delete using (public.is_org_admin(organization_id));

create table public.marketing_contents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_type text not null check (content_type in ('post', 'ad', 'email', 'message', 'ideia')),
  title text,
  body text,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'publicado')),
  ai_generated boolean not null default false,
  scheduled_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_marketing_contents_campaign on public.marketing_contents(campaign_id);
create index idx_marketing_contents_org on public.marketing_contents(organization_id);

alter table public.marketing_contents enable row level security;
create policy marketing_contents_select on public.marketing_contents for select using (public.is_org_member(organization_id));
create policy marketing_contents_insert on public.marketing_contents for insert with check (public.is_org_member(organization_id));
create policy marketing_contents_update on public.marketing_contents for update using (public.is_org_member(organization_id));
create policy marketing_contents_delete on public.marketing_contents for delete using (public.is_org_member(organization_id));
