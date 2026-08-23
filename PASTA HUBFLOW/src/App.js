// src/App.js
import React from 'https://esm.sh/react@18';
import { html } from './components/ui.js';
import { LoginPage, CadastroPage } from './pages/auth.js';
import { DashboardPage } from './pages/dashboard.js';
import { ClientesPage } from './pages/clientes.js';
import { OrcamentosPage } from './pages/orcamentos.js';
import { OrdensServicoPage } from './pages/ordensServico.js';
import { AgendaPage } from './pages/agenda.js';
import { FinanceiroPage } from './pages/financeiro.js';
import { DocumentosPage } from './pages/documentos.js';
import { IAPage } from './pages/ia.js';
import { ConfiguracoesPage } from './pages/configuracoes.js';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '▤' },
  { to: '/clientes', label: 'Clientes', icon: '◎' },
  { to: '/orcamentos', label: 'Orçamentos', icon: '§' },
  { to: '/ordens-servico', label: 'Ordens de Serviço', icon: '✓' },
  { to: '/agenda', label: 'Agenda', icon: '▦' },
  { to: '/financeiro', label: 'Financeiro', icon: '$' },
  { to: '/documentos', label: 'Documentos', icon: '▣' },
  { to: '/ia', label: 'IA', icon: '✦' },
  { to: '/configuracoes', label: 'Configurações', icon: '⚙' },
];

const PAGES = {
  '/dashboard': DashboardPage,
  '/clientes': ClientesPage,
  '/orcamentos': OrcamentosPage,
  '/ordens-servico': OrdensServicoPage,
  '/agenda': AgendaPage,
  '/financeiro': FinanceiroPage,
  '/documentos': DocumentosPage,
  '/ia': IAPage,
  '/configuracoes': ConfiguracoesPage,
};

function useHashRoute() {
  const [route, setRoute] = React.useState(() => window.location.hash.replace('#', '') || '/login');
  React.useEffect(() => {
    const onChange = () => setRoute(window.location.hash.replace('#', '') || '/login');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = (to) => { window.location.hash = to; };
  return [route, navigate];
}

function AppShell({ route, navigate, children }) {
  return html`
    <div class="hf-app">
      <aside class="hf-sidebar">
        <div class="hf-sidebar__logo"><span class="hf-sidebar__logo-mark">H</span>HubFlow</div>
        <nav class="hf-nav">
          ${NAV_ITEMS.map(
            (item) => html`
              <a href=${`#${item.to}`} class=${route === item.to ? 'is-active' : ''}>
                <span class="hf-nav-icon">${item.icon}</span>${item.label}
              </a>
            `
          )}
        </nav>
        <div class="hf-sidebar__footer">Dados de exemplo — sessão local, não persistente.</div>
      </aside>
      <div class="hf-main">
        <div class="hf-topbar">
          <span class="hf-topbar__title">${NAV_ITEMS.find((i) => i.to === route)?.label || ''}</span>
          <a href="#/login" class="hf-btn hf-btn--ghost" style=${{ padding: '6px 12px', fontSize: '0.8rem' }}>Sair</a>
        </div>
        <div class="hf-content">${children}</div>
      </div>
    </div>
  `;
}

export function App() {
  const [route, navigate] = useHashRoute();

  if (route === '/login') return html`<${LoginPage} onEnter=${() => navigate('/dashboard')} />`;
  if (route === '/cadastro') return html`<${CadastroPage} onEnter=${() => navigate('/dashboard')} />`;

  const Page = PAGES[route] || DashboardPage;
  return html`
    <${AppShell} route=${route} navigate=${navigate}>
      <${Page} navigate=${navigate} />
    <//>
  `;
}
