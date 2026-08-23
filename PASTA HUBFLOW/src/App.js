// src/App.js
import React from 'https://esm.sh/react@18';
import { html } from './components/ui.js';
import { LoginPage, CadastroPage, NovaSenhaPage } from './pages/auth.js';
import { DashboardPage } from './pages/dashboard.js';
import { ClientesPage } from './pages/clientes.js';
import { ServicosPage } from './pages/servicos.js';
import { OrcamentosPage } from './pages/orcamentos.js';
import { OrdensServicoPage } from './pages/ordensServico.js';
import { AgendaPage } from './pages/agenda.js';
import { FinanceiroPage } from './pages/financeiro.js';
import { FornecedoresPage } from './pages/fornecedores.js';
import { DocumentosPage } from './pages/documentos.js';
import { IAPage } from './pages/ia.js';
import { ConfiguracoesPage } from './pages/configuracoes.js';
import { supabase } from './services/supabaseClient.js';
import { getMyProfile, getOrEnsureOrganization, signOut } from './services/auth.js';
import { setCurrentOrganizationId } from './services/api.js';
import { NotificationsBell } from './components/notificationsBell.js';

// Agrupamento do menu lateral por área de trabalho — facilita achar algo
// conforme o número de módulos cresce (ver docs/BACKEND.md, Bloco 3).
const NAV_GROUPS = [
  {
    label: 'Visão geral',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: '▤' }],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/clientes', label: 'Clientes', icon: '◎' },
      { to: '/servicos', label: 'Serviços', icon: '◆' },
      { to: '/fornecedores', label: 'Fornecedores', icon: '▲' },
      { to: '/documentos', label: 'Documentos', icon: '▣' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { to: '/orcamentos', label: 'Orçamentos', icon: '§' },
      { to: '/ordens-servico', label: 'Ordens de Serviço', icon: '✓' },
      { to: '/agenda', label: 'Agenda', icon: '▦' },
    ],
  },
  {
    label: 'Financeiro',
    items: [{ to: '/financeiro', label: 'Financeiro', icon: '$' }],
  },
  {
    label: 'Inteligência',
    items: [{ to: '/ia', label: 'IA', icon: '✦' }],
  },
  {
    label: 'Sistema',
    items: [{ to: '/configuracoes', label: 'Configurações', icon: '⚙' }],
  },
];
const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const PAGES = {
  '/dashboard': DashboardPage,
  '/clientes': ClientesPage,
  '/servicos': ServicosPage,
  '/orcamentos': OrcamentosPage,
  '/ordens-servico': OrdensServicoPage,
  '/agenda': AgendaPage,
  '/financeiro': FinanceiroPage,
  '/fornecedores': FornecedoresPage,
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

function AppShell({ route, navigate, onSair, profile, organization, children }) {
  const [menuAberto, setMenuAberto] = React.useState(false);
  React.useEffect(() => setMenuAberto(false), [route]);

  return html`
    <div class="hf-app">
      <div class=${`hf-sidebar-overlay ${menuAberto ? 'is-open' : ''}`} onClick=${() => setMenuAberto(false)}></div>
      <aside class=${`hf-sidebar ${menuAberto ? 'is-open' : ''}`}>
        <div class="hf-sidebar__logo"><span class="hf-sidebar__logo-mark">H</span>HubFlow</div>
        <nav class="hf-nav">
          ${NAV_GROUPS.map(
            (group) => html`
              <div class="hf-nav-group" key=${group.label}>
                <div class="hf-nav-group__label">${group.label}</div>
                ${group.items.map(
                  (item) => html`
                    <a href=${`#${item.to}`} class=${route === item.to ? 'is-active' : ''}>
                      <span class="hf-nav-icon">${item.icon}</span>${item.label}
                    </a>
                  `
                )}
              </div>
            `
          )}
        </nav>
        <div class="hf-sidebar__footer">${profile?.full_name || profile?.email || 'Sessão autenticada'}</div>
      </aside>
      <div class="hf-main">
        <div class="hf-topbar">
          <div style=${{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button class="hf-menu-btn" onClick=${() => setMenuAberto(true)} aria-label="Abrir menu">☰</button>
            <span class="hf-topbar__title">${NAV_ITEMS.find((i) => i.to === route)?.label || ''}</span>
          </div>
          <div style=${{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <${NotificationsBell} organization=${organization} navigate=${navigate} />
            <button onClick=${onSair} class="hf-btn hf-btn--ghost" style=${{ padding: '6px 12px', fontSize: '0.8rem' }}>Sair</button>
          </div>
        </div>
        <div class="hf-content">${children}</div>
      </div>
    </div>
  `;
}

/**
 * Estado de autenticação da aplicação inteira. Carrega a sessão do Supabase
 * uma vez, escuta mudanças (login/logout/token renovado/recuperação de
 * senha) e, quando autenticado, garante profile + organização do usuário.
 */
function useAuth() {
  const [state, setState] = React.useState({ status: 'loading', session: null, profile: null, organization: null });

  const carregarPerfilEOrganizacao = React.useCallback(async (session) => {
    try {
      const [profile, organization] = await Promise.all([getMyProfile(), getOrEnsureOrganization()]);
      setCurrentOrganizationId(organization?.id);
      setState({ status: 'authenticated', session, profile, organization });
    } catch (err) {
      console.error('Falha ao carregar perfil/organização:', err);
      setState({ status: 'authenticated', session, profile: null, organization: null });
    }
  }, []);

  React.useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return;
      if (session) carregarPerfilEOrganizacao(session);
      else {
        setCurrentOrganizationId(null);
        setState({ status: 'anonymous', session: null, profile: null, organization: null });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ativo) return;
      if (event === 'PASSWORD_RECOVERY') {
        window.location.hash = '/nova-senha';
        return;
      }
      if (session) carregarPerfilEOrganizacao(session);
      else {
        setCurrentOrganizationId(null);
        setState({ status: 'anonymous', session: null, profile: null, organization: null });
      }
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [carregarPerfilEOrganizacao]);

  return state;
}

export function App() {
  const [route, navigate] = useHashRoute();
  const auth = useAuth();

  if (route === '/nova-senha') {
    return html`<${NovaSenhaPage} onConcluido=${() => navigate('/dashboard')} />`;
  }

  if (auth.status === 'loading') {
    return html`
      <div class="hf-auth">
        <div class="hf-auth-card">
          <div class="hf-sidebar__logo" style=${{ padding: 0 }}><span class="hf-sidebar__logo-mark">H</span>HubFlow</div>
          <p style=${{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>Carregando...</p>
        </div>
      </div>
    `;
  }

  if (auth.status === 'anonymous') {
    if (route === '/cadastro') return html`<${CadastroPage} onEnter=${() => navigate('/dashboard')} />`;
    return html`<${LoginPage} onEnter=${() => navigate('/dashboard')} />`;
  }

  // Autenticado: /login e /cadastro não fazem sentido mais — manda para o painel.
  if (route === '/login' || route === '/cadastro') {
    navigate('/dashboard');
    return null;
  }

  async function handleSair() {
    await signOut();
    navigate('/login');
  }

  const Page = PAGES[route] || DashboardPage;
  return html`
    <${AppShell} route=${route} navigate=${navigate} onSair=${handleSair} profile=${auth.profile} organization=${auth.organization}>
      <${Page} navigate=${navigate} profile=${auth.profile} organization=${auth.organization} />
    <//>
  `;
}
