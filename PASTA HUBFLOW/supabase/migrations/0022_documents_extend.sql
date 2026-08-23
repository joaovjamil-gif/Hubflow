alter table public.documents
  add column category text,
  add column description text,
  add column updated_at timestamptz not null default now();

create trigger trg_documents_updated_at before update on public.documents
for each row execute function public.set_updated_at();

alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('customer','quote','work_order','supplier','profile','organization','financial'));
