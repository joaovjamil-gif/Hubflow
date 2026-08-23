-- Um serviço do catálogo pode, no futuro, ser excluído de verdade (hoje só
-- desativado pela UI). Itens de orçamento/OS já emitidos devem manter seu
-- texto/preço congelados (histórico), só perdendo o vínculo com o
-- catálogo — não podem impedir a exclusão nem sumir.
alter table public.quote_items drop constraint quote_items_service_id_fkey;
alter table public.quote_items add constraint quote_items_service_id_fkey
  foreign key (service_id) references public.services(id) on delete set null;

alter table public.work_order_items drop constraint work_order_items_service_id_fkey;
alter table public.work_order_items add constraint work_order_items_service_id_fkey
  foreign key (service_id) references public.services(id) on delete set null;
