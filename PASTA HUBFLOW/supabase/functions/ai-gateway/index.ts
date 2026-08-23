// supabase/functions/ai-gateway/index.ts
//
// Ponto único de entrada para qualquer chamada de IA da HubFlow. Nunca expõe
// chave de provedor de IA no frontend — o frontend chama esta função via
// supabase.functions.invoke('ai-gateway', {...}) autenticado, e é aqui (com
// service role implícito do runtime da Edge Function) que uma chave de
// provedor seria usada, se existisse.
//
// Estado atual: nenhum provedor está configurado (sem AI_PROVIDER_API_KEY).
// A função responde honestamente com status "not_configured" em vez de
// inventar qualquer resposta de IA — ver docs/BACKEND.md, seção IA.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing_auth' }), { status: 401 });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { organization_id, operation_type, context, prompt } = body ?? {};
    if (!organization_id || !operation_type) {
      return new Response(
        JSON.stringify({ error: 'missing_params', detail: 'organization_id e operation_type são obrigatórios' }),
        { status: 400 }
      );
    }

    // Insert grava sob RLS (o client usa o token do usuário, não service role):
    // se o usuário não pertencer à organização, a policy de ai_requests barra
    // o insert e o erro vira org_access_denied abaixo — dupla checagem real,
    // não apenas confiança no organization_id enviado pelo cliente.
    const { data: reqRow, error: insertError } = await supabase
      .from('ai_requests')
      .insert({
        organization_id,
        user_id: userData.user.id,
        operation_type,
        context: context ?? null,
        prompt: prompt ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !reqRow) {
      return new Response(JSON.stringify({ error: 'org_access_denied', detail: insertError?.message }), { status: 403 });
    }

    const providerKey = Deno.env.get('AI_PROVIDER_API_KEY');
    if (!providerKey) {
      await supabase
        .from('ai_requests')
        .update({
          status: 'failed',
          error: 'Provedor de IA ainda não configurado (AI_PROVIDER_API_KEY ausente).',
          completed_at: new Date().toISOString(),
        })
        .eq('id', reqRow.id);
      return new Response(
        JSON.stringify({
          status: 'not_configured',
          message:
            'A IA ainda não está conectada a um provedor. Configure AI_PROVIDER_API_KEY nas variáveis de ambiente desta Edge Function para ativar.',
          request_id: reqRow.id,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Ponto de integração com um provedor real — deliberadamente não
    // implementado ainda (nenhuma chave configurada até o momento). Quando um
    // provedor for conectado, a chamada HTTP ao provedor entra aqui, usando
    // `providerKey` só neste runtime server-side, nunca no navegador.
    await supabase
      .from('ai_requests')
      .update({ status: 'failed', error: 'Integração com provedor ainda não implementada.', completed_at: new Date().toISOString() })
      .eq('id', reqRow.id);
    return new Response(JSON.stringify({ status: 'not_implemented', request_id: reqRow.id }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', detail: String(err) }), { status: 500 });
  }
});
