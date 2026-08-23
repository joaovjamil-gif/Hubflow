// src/pages/auth.js
import React from 'https://esm.sh/react@18';
import { html, Button, Input, Field } from '../components/ui.js';
import { signIn, signUp, requestPasswordReset, updatePassword, friendlyAuthError } from '../services/auth.js';

function ErrorNote({ children }) {
  if (!children) return null;
  return html`<p style=${{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>${children}</p>`;
}

export function LoginPage({ onEnter }) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [carregando, setCarregando] = React.useState(false);

  const [modoRecuperar, setModoRecuperar] = React.useState(false);
  const [emailRecuperar, setEmailRecuperar] = React.useState('');
  const [recuperarEnviado, setRecuperarEnviado] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await signIn({ email, password: senha });
      onEnter();
    } catch (err) {
      setErro(friendlyAuthError(err));
    } finally {
      setCarregando(false);
    }
  }

  async function enviarRecuperacao(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await requestPasswordReset(emailRecuperar);
      setRecuperarEnviado(true);
    } catch (err) {
      setErro(friendlyAuthError(err));
    } finally {
      setCarregando(false);
    }
  }

  if (modoRecuperar) {
    return html`
      <div class="hf-auth">
        <div class="hf-auth-card">
          <div class="hf-sidebar__logo" style=${{ padding: 0 }}>
            <span class="hf-sidebar__logo-mark">H</span>HubFlow
          </div>
          <p style=${{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>Recuperar senha.</p>
          ${recuperarEnviado
            ? html`
                <p style=${{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '20px', lineHeight: 1.6 }}>
                  Se existir uma conta com o e-mail <strong>${emailRecuperar}</strong>, enviamos um link para redefinir a senha.
                </p>
              `
            : html`
                <form onSubmit=${enviarRecuperacao}>
                  <${Field} label="E-mail">
                    <${Input} type="email" required value=${emailRecuperar} onChange=${(e) => setEmailRecuperar(e.target.value)} placeholder="voce@email.com" />
                  <//>
                  <${ErrorNote}>${erro}<//>
                  <${Button} variant="primary" size="lg" type="submit" disabled=${carregando}>${carregando ? 'Enviando...' : 'Enviar link de recuperação'}<//>
                </form>
              `}
          <p class="hf-auth-note">
            <a href="#" onClick=${(e) => { e.preventDefault(); setModoRecuperar(false); setErro(''); }} style=${{ color: 'var(--accent)' }}>← Voltar para o login</a>
          </p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="hf-auth">
      <div class="hf-auth-card">
        <div class="hf-sidebar__logo" style=${{ padding: 0 }}>
          <span class="hf-sidebar__logo-mark">H</span>HubFlow
        </div>
        <p style=${{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>Entre na sua conta.</p>
        <form onSubmit=${submit}>
          <${Field} label="E-mail">
            <${Input} type="email" required value=${email} onChange=${(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          <//>
          <${Field} label="Senha">
            <${Input} type="password" required value=${senha} onChange=${(e) => setSenha(e.target.value)} placeholder="••••••••" />
          <//>
          <${ErrorNote}>${erro}<//>
          <${Button} variant="primary" size="lg" type="submit" disabled=${carregando}>${carregando ? 'Entrando...' : 'Entrar'}<//>
        </form>
        <p class="hf-auth-note">
          <a href="#" onClick=${(e) => { e.preventDefault(); setModoRecuperar(true); setErro(''); }} style=${{ color: 'var(--accent)' }}>Esqueceu a senha?</a>
        </p>
        <p class="hf-auth-note">Ainda não tem conta? <a href="#/cadastro" style=${{ color: 'var(--accent)' }}>Criar conta grátis</a></p>
      </div>
    </div>
  `;
}

export function CadastroPage({ onEnter }) {
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [carregando, setCarregando] = React.useState(false);
  const [confirmacaoPendente, setConfirmacaoPendente] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const data = await signUp({ email, password: senha, fullName: nome });
      if (!data.session) {
        // Projeto configurado para exigir confirmação de e-mail antes do primeiro login.
        setConfirmacaoPendente(true);
      } else {
        onEnter();
      }
    } catch (err) {
      setErro(friendlyAuthError(err));
    } finally {
      setCarregando(false);
    }
  }

  if (confirmacaoPendente) {
    return html`
      <div class="hf-auth">
        <div class="hf-auth-card">
          <div class="hf-sidebar__logo" style=${{ padding: 0 }}>
            <span class="hf-sidebar__logo-mark">H</span>HubFlow
          </div>
          <p style=${{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '20px', lineHeight: 1.6 }}>
            Enviamos um link de confirmação para <strong>${email}</strong>. Confirme seu e-mail e depois entre normalmente.
          </p>
          <p class="hf-auth-note"><a href="#/login" style=${{ color: 'var(--accent)' }}>Ir para o login</a></p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="hf-auth">
      <div class="hf-auth-card">
        <div class="hf-sidebar__logo" style=${{ padding: 0 }}>
          <span class="hf-sidebar__logo-mark">H</span>HubFlow
        </div>
        <p style=${{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>Crie sua conta gratuita.</p>
        <form onSubmit=${submit}>
          <${Field} label="Nome">
            <${Input} required value=${nome} onChange=${(e) => setNome(e.target.value)} placeholder="Seu nome" />
          <//>
          <${Field} label="E-mail">
            <${Input} type="email" required value=${email} onChange=${(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          <//>
          <${Field} label="Senha">
            <${Input} type="password" required minLength="6" value=${senha} onChange=${(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          <//>
          <${ErrorNote}>${erro}<//>
          <${Button} variant="primary" size="lg" type="submit" disabled=${carregando}>${carregando ? 'Criando...' : 'Criar conta'}<//>
        </form>
        <p class="hf-auth-note">Já tem conta? <a href="#/login" style=${{ color: 'var(--accent)' }}>Entrar</a></p>
      </div>
    </div>
  `;
}

export function NovaSenhaPage({ onConcluido }) {
  const [senha, setSenha] = React.useState('');
  const [confirmacao, setConfirmacao] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [carregando, setCarregando] = React.useState(false);
  const [sucesso, setSucesso] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }
    setCarregando(true);
    try {
      await updatePassword(senha);
      setSucesso(true);
    } catch (err) {
      setErro(friendlyAuthError(err));
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return html`
      <div class="hf-auth">
        <div class="hf-auth-card">
          <div class="hf-sidebar__logo" style=${{ padding: 0 }}>
            <span class="hf-sidebar__logo-mark">H</span>HubFlow
          </div>
          <p style=${{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '20px', marginBottom: '20px' }}>Senha atualizada com sucesso.</p>
          <${Button} variant="primary" size="lg" onClick=${onConcluido}>Ir para o painel<//>
        </div>
      </div>
    `;
  }

  return html`
    <div class="hf-auth">
      <div class="hf-auth-card">
        <div class="hf-sidebar__logo" style=${{ padding: 0 }}>
          <span class="hf-sidebar__logo-mark">H</span>HubFlow
        </div>
        <p style=${{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>Defina sua nova senha.</p>
        <form onSubmit=${submit}>
          <${Field} label="Nova senha">
            <${Input} type="password" required minLength="6" value=${senha} onChange=${(e) => setSenha(e.target.value)} />
          <//>
          <${Field} label="Confirmar nova senha">
            <${Input} type="password" required minLength="6" value=${confirmacao} onChange=${(e) => setConfirmacao(e.target.value)} />
          <//>
          <${ErrorNote}>${erro}<//>
          <${Button} variant="primary" size="lg" type="submit" disabled=${carregando}>${carregando ? 'Salvando...' : 'Salvar nova senha'}<//>
        </form>
      </div>
    </div>
  `;
}
