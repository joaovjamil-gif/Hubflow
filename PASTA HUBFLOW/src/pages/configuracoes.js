// src/pages/configuracoes.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Card, Field, Input, Button } from '../components/ui.js';
import { updateMyProfile, signOut, friendlyAuthError } from '../services/auth.js';
import { updateOrganization } from '../services/organizations.js';

export function ConfiguracoesPage({ navigate, profile, organization }) {
  const [nome, setNome] = React.useState(profile?.full_name || '');
  const [telefonePessoal, setTelefonePessoal] = React.useState(profile?.phone || '');
  const [salvandoPerfil, setSalvandoPerfil] = React.useState(false);
  const [feedbackPerfil, setFeedbackPerfil] = React.useState('');
  const [erroPerfil, setErroPerfil] = React.useState('');

  const [nomeNegocio, setNomeNegocio] = React.useState(organization?.name || '');
  const [telefoneNegocio, setTelefoneNegocio] = React.useState(organization?.phone || '');
  const [salvandoNegocio, setSalvandoNegocio] = React.useState(false);
  const [feedbackNegocio, setFeedbackNegocio] = React.useState('');
  const [erroNegocio, setErroNegocio] = React.useState('');

  React.useEffect(() => {
    setNome(profile?.full_name || '');
    setTelefonePessoal(profile?.phone || '');
  }, [profile?.id]);

  React.useEffect(() => {
    setNomeNegocio(organization?.name || '');
    setTelefoneNegocio(organization?.phone || '');
  }, [organization?.id]);

  async function salvarPerfil(e) {
    e.preventDefault();
    setErroPerfil('');
    setSalvandoPerfil(true);
    try {
      await updateMyProfile({ full_name: nome, phone: telefonePessoal });
      setFeedbackPerfil('Dados pessoais salvos.');
      setTimeout(() => setFeedbackPerfil(''), 3000);
    } catch (err) {
      setErroPerfil(friendlyAuthError(err));
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function salvarNegocio(e) {
    e.preventDefault();
    setErroNegocio('');
    if (!organization?.id) {
      setErroNegocio('Organização ainda não carregada — recarregue a página.');
      return;
    }
    setSalvandoNegocio(true);
    try {
      await updateOrganization(organization.id, { name: nomeNegocio, phone: telefoneNegocio });
      setFeedbackNegocio('Perfil do negócio salvo.');
      setTimeout(() => setFeedbackNegocio(''), 3000);
    } catch (err) {
      setErroNegocio(err.message || 'Erro ao salvar.');
    } finally {
      setSalvandoNegocio(false);
    }
  }

  async function sair() {
    await signOut();
    navigate('/login');
  }

  return html`
    <div>
      <${PageHeader} eyebrow="Conta" title="Configurações" />
      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Meus dados</h3>
          <form onSubmit=${salvarPerfil} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <${Field} label="Nome completo"><${Input} value=${nome} onChange=${(e) => setNome(e.target.value)} placeholder="Seu nome" /><//>
            <${Field} label="E-mail"><${Input} value=${profile?.email || ''} disabled /><//>
            <${Field} label="Telefone"><${Input} value=${telefonePessoal} onChange=${(e) => setTelefonePessoal(e.target.value)} placeholder="(11) 99999-0000" /><//>
            ${erroPerfil && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erroPerfil}</p>`}
            ${feedbackPerfil && html`<p style=${{ color: 'var(--success)', fontSize: '0.82rem', margin: 0 }}>${feedbackPerfil}</p>`}
            <${Button} variant="ghost" type="submit" disabled=${salvandoPerfil}>${salvandoPerfil ? 'Salvando...' : 'Salvar alterações'}<//>
          </form>
        <//>

        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Perfil do negócio</h3>
          <form onSubmit=${salvarNegocio} style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <${Field} label="Nome do negócio"><${Input} value=${nomeNegocio} onChange=${(e) => setNomeNegocio(e.target.value)} placeholder="Sua empresa" /><//>
            <${Field} label="Telefone de contato"><${Input} value=${telefoneNegocio} onChange=${(e) => setTelefoneNegocio(e.target.value)} placeholder="(11) 99999-0000" /><//>
            ${erroNegocio && html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${erroNegocio}</p>`}
            ${feedbackNegocio && html`<p style=${{ color: 'var(--success)', fontSize: '0.82rem', margin: 0 }}>${feedbackNegocio}</p>`}
            <${Button} variant="ghost" type="submit" disabled=${salvandoNegocio}>${salvandoNegocio ? 'Salvando...' : 'Salvar alterações'}<//>
          </form>
        <//>
      </div>

      <div style=${{ marginTop: 20 }}>
        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Sessão</h3>
          <p style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Sua conta está autenticada via Supabase Auth. Trocar de senha pode ser feito pelo link "Esqueceu a senha?" na tela de login.
          </p>
          <${Button} variant="danger" onClick=${sair}>Sair da conta<//>
        <//>
      </div>
    </div>
  `;
}
