// src/services/supabaseClient.js
//
// Cliente único do Supabase para toda a aplicação. Sem bundler neste projeto
// (ver README), então o SDK é carregado via esm.sh, no mesmo padrão de
// src/main.js e src/components/ui.js.
//
// A chave abaixo é a "anon key" pública do projeto — ela é segura para ficar
// no frontend por design: toda a proteção de dado real vive no Row Level
// Security do Postgres (ver PASTA HUBFLOW/supabase/migrations e
// docs/BACKEND.md), não nesta chave. A service_role key NUNCA deve ser usada
// aqui.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://edjsleldeautikzccfwt.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkanNsZWxkZWF1dGlremNjZnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NjQ0ODgsImV4cCI6MjEwMzA0MDQ4OH0.Hmj2YqsGYp46aO406I21qDLSiKmAF1NOcspUS7RekSg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
