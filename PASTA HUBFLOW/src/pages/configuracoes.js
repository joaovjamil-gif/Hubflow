// src/pages/configuracoes.js
import React from 'https://esm.sh/react@18';
import { html, PageHeader, Card, Field, Input, Button } from '../components/ui.js';

export function ConfiguracoesPage() {
  return html`
    <div>
      <${PageHeader} eyebrow="Conta" title="Configurações" />
      <div style=${{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Perfil do negócio</h3>
          <div style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <${Field} label="Nome do negócio"><${Input} placeholder="Sua empresa" /><//>
            <${Field} label="Telefone de contato"><${Input} placeholder="(11) 99999-0000" /><//>
            <${Button} variant="ghost">Salvar alterações<//>
          </div>
        <//>
        <${Card}>
          <h3 style=${{ marginBottom: 14 }}>Conta</h3>
          <p style=${{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Autenticação, troca de senha e dados de cobrança ficam disponíveis assim que o backend
            (Supabase Auth) estiver conectado.
          </p>
          <${Button} variant="danger">Sair da conta<//>
        <//>
      </div>
    </div>
  `;
}
