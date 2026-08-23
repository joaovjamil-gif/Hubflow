-- Equipe: uma OS pode ter mais de um responsável (além do responsible_id
-- "principal" já existente em work_orders, que continua sendo quem
-- coordena). Isso é o que a Fase pediu como "equipe".
create table public.work_order_team (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text,
  created_at timestamptz not null default now(),
  unique (work_order_id, user_id)
);
create index idx_work_order_team_wo on public.work_order_team(work_order_id);

alter table public.work_order_team enable row level security;
create policy work_order_team_select on public.work_order_team for select using (
  exists (select 1 from public.work_orders w where w.id = work_order_team.work_order_id and public.is_org_member(w.organization_id))
);
create policy work_order_team_insert on public.work_order_team for insert with check (
  exists (select 1 from public.work_orders w where w.id = work_order_team.work_order_id and public.is_org_member(w.organization_id))
);
create policy work_order_team_delete on public.work_order_team for delete using (
  exists (select 1 from public.work_orders w where w.id = work_order_team.work_order_id and public.is_org_member(w.organization_id))
);

-- Checklist: lista de tarefas da execução, separada dos itens cobráveis
-- (work_order_items). Pensada para o técnico marcar em campo (celular,
-- numa fase futura) — por isso já fica com "position" para ordenação.
create table public.work_order_checklist_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  description text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  done_at timestamptz,
  done_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_wo_checklist_wo on public.work_order_checklist_items(work_order_id);

create trigger trg_wo_checklist_updated_at before update on public.work_order_checklist_items
for each row execute function public.set_updated_at();

alter table public.work_order_checklist_items enable row level security;
create policy wo_checklist_select on public.work_order_checklist_items for select using (
  exists (select 1 from public.work_orders w where w.id = work_order_checklist_items.work_order_id and public.is_org_member(w.organization_id))
);
create policy wo_checklist_insert on public.work_order_checklist_items for insert with check (
  exists (select 1 from public.work_orders w where w.id = work_order_checklist_items.work_order_id and public.is_org_member(w.organization_id))
);
create policy wo_checklist_update on public.work_order_checklist_items for update using (
  exists (select 1 from public.work_orders w where w.id = work_order_checklist_items.work_order_id and public.is_org_member(w.organization_id))
);
create policy wo_checklist_delete on public.work_order_checklist_items for delete using (
  exists (select 1 from public.work_orders w where w.id = work_order_checklist_items.work_order_id and public.is_org_member(w.organization_id))
);

-- Preparo para aceite/assinatura do cliente (não implementado nesta etapa,
-- só a coluna — ver instrução explícita de não construir isso agora).
alter table public.work_orders
  add column signature_url text,
  add column accepted_by_name text,
  add column accepted_at timestamptz;
