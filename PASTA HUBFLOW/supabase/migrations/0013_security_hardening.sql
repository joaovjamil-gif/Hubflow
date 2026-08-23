-- Correções apontadas pelo Supabase Security Advisor após a criação do
-- schema: fixar search_path na função de trigger, e restringir a execução
-- direta (via RPC) das funções helper de RLS a usuários autenticados —
-- elas devem ser usadas pelas policies, não chamadas livremente por anon.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

revoke execute on function public.is_org_admin(uuid) from public, anon;
grant execute on function public.is_org_admin(uuid) to authenticated;

revoke execute on function public.user_org_role(uuid) from public, anon;
grant execute on function public.user_org_role(uuid) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
