-- Metadados de documentos + bucket privado no Supabase Storage.
-- O conteúdo binário nunca é guardado no banco, só no Storage.
-- Convenção de caminho: {organization_id}/{entity_type}/{entity_id}/{filename}
-- (o primeiro segmento do caminho é usado pelas policies de Storage abaixo
-- para checar a organização do usuário).

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  original_name text not null,
  storage_name text not null,
  storage_path text not null,
  bucket text not null default 'documents',
  mime_type text,
  size_bytes bigint,
  entity_type text not null check (entity_type in ('customer','quote','work_order','profile','organization','financial')),
  entity_id uuid,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_documents_org on public.documents(organization_id);
create index idx_documents_entity on public.documents(entity_type, entity_id);

alter table public.documents enable row level security;
create policy documents_select on public.documents for select using (public.is_org_member(organization_id));
create policy documents_insert on public.documents for insert with check (public.is_org_member(organization_id));
create policy documents_update on public.documents for update using (public.is_org_member(organization_id));
create policy documents_delete on public.documents for delete using (public.is_org_member(organization_id));

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy storage_documents_select on storage.objects
  for select using (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy storage_documents_insert on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy storage_documents_update on storage.objects
  for update using (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy storage_documents_delete on storage.objects
  for delete using (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );
