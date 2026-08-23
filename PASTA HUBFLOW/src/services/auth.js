// src/services/auth.js
//
// Camada única de autenticação. Páginas nunca chamam `supabase.auth`
// diretamente — sempre passam por aqui, no mesmo espírito de
// src/services/api.js (um arquivo concentra a integração real, para poder
// trocar de provedor sem tocar nas páginas).

import { supabase } from './supabaseClient.js';

export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}#/nova-senha`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getMyProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(patch) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error('Não autenticado');
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select().single();
  if (error) throw error;
  return data;
}

/**
 * Garante que o usuário autenticado tenha uma organização. Hoje a aplicação
 * ainda não tem uma tela de criar/selecionar/convidar para organizações
 * (ver docs/BACKEND.md, seção "Pendências"), então no primeiro login de cada
 * usuário provisionamos uma organização pessoal automaticamente, com ele
 * como "owner". Isso é uma ponte deliberada, não o desenho final do multi-
 * tenant: quando existir UI de organizações, este bootstrap deixa de ser
 * necessário.
 */
export async function getOrEnsureOrganization() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data: memberships, error: memErr } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1);
  if (memErr) throw memErr;

  if (memberships && memberships.length > 0) {
    return memberships[0].organizations;
  }

  const nomePadrao = user.user_metadata?.full_name ? `Negócio de ${user.user_metadata.full_name}` : 'Meu negócio';

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({ name: nomePadrao })
    .select()
    .single();
  if (orgErr) throw orgErr;

  const { error: memberErr } = await supabase
    .from('organization_members')
    .insert({ organization_id: org.id, user_id: user.id, role: 'owner' });
  if (memberErr) throw memberErr;

  return org;
}

/** Traduz os erros mais comuns do Supabase Auth para mensagens em português. */
export function friendlyAuthError(err) {
  const msg = err?.message || '';
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('User already registered')) return 'Já existe uma conta com este e-mail.';
  if (msg.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).';
  if (msg.includes('For security purposes')) return 'Muitas tentativas seguidas. Aguarde um momento e tente novamente.';
  return msg || 'Ocorreu um erro. Tente novamente.';
}
