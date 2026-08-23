-- Histórico de alterações (imutável — sem policy de UPDATE/DELETE) e
-- notificações internas por usuário.

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('create','update','delete','approve','reject','complete','cancel','other')),
  description text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index idx_activity_logs_org on public.activity_logs(organization_id);
create index idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);

alter table public.activity_logs enable row level security;
create policy activity_logs_select on public.activity_logs for select using (public.is_org_member(organization_id));
create policy activity_logs_insert on public.activity_logs for insert with check (public.is_org_member(organization_id));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text,
  type text not null default 'info' check (type in ('info','success','warning','error')),
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_org on public.notifications(organization_id);

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update using (user_id = auth.uid());
create policy notifications_insert_member on public.notifications for insert with check (public.is_org_member(organization_id));
create policy notifications_delete_own on public.notifications for delete using (user_id = auth.uid());
