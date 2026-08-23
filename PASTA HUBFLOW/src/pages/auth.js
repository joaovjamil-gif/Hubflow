// src/pages/auth.js
import React from 'https://esm.sh/react@18';
import { html, Button, Input, Field } from '../components/ui.js';

export function LoginPage({ onEnter }) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');

  function submit(e) {
    e.preventDefault();
    // MOCK: não existe autenticação real neste ambiente (sem backend).
    // Isso apenas simula a navegação pós-login para permitir testar a UI interna.
    onEnter();
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
          <${Button} variant="primary" size="lg" type="submit">Entrar<//>
        </form>
        <p class="hf-auth-note">Ainda não tem conta? <a href="#/cadastro" style=${{ color: 'var(--accent)' }}>Criar conta grátis</a></p>
      </div>
    </div>
  `;
}

export function CadastroPage({ onEnter }) {
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');

  function submit(e) {
    e.preventDefault();
    // MOCK: idem — sem backend, não há criação de conta real.
    onEnter();
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
            <${Input} type="password" required value=${senha} onChange=${(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" />
          <//>
          <${Button} variant="primary" size="lg" type="submit">Criar conta<//>
        </form>
        <p class="hf-auth-note">Já tem conta? <a href="#/login" style=${{ color: 'var(--accent)' }}>Entrar</a></p>
      </div>
    </div>
  `;
}
