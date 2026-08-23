-- Índices de busca (ILIKE) nos campos usados pelas telas de busca/filtro.
-- pg_trgm justificado: busca por substring em nome/documento/número é o
-- padrão de uso principal destas telas.
create extension if not exists pg_trgm;

create index if not exists idx_customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create index if not exists idx_customers_document_trgm on public.customers using gin (document gin_trgm_ops);
create index if not exists idx_customers_phone on public.customers (phone);

create index if not exists idx_quotes_number_trgm on public.quotes using gin (number gin_trgm_ops);
create index if not exists idx_work_orders_number_trgm on public.work_orders using gin (number gin_trgm_ops);

create index if not exists idx_suppliers_name_trgm on public.suppliers using gin (name gin_trgm_ops);
create index if not exists idx_suppliers_document_trgm on public.suppliers using gin (document gin_trgm_ops);

create index if not exists idx_services_name_trgm on public.services using gin (name gin_trgm_ops);

create index if not exists idx_accounts_payable_supplier on public.accounts_payable(supplier_id);
