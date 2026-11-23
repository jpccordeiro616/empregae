// ==========================================================
// Empregae — estado, navegação e inicialização
// Carregado por último: guarda o estado da aplicação, desenha as telas e inicia a sessão.
// ==========================================================

const state = {
    view: 'landing',
    token: null,
    tipo: null,          // 'jovem' ou 'empresa'
    usuario: null,       // perfil devolvido pela API
    loginTipo: 'jovem',
    erroForm: '',
    vagasPublicas: null, // vagas abertas mostradas na página inicial
    jovem: {
        aba: 'vagas',
        recomendacoes: null,
        candidaturas: null,
        busca: '',
        resultadosBusca: null,
        conversaAtiva: 0,
        videoUrl: null,
        empresaAberta: null,   // perfil de empresa sendo visto
    },
    empresa: null,       // preenchido por estadoEmpresaInicial()
};

// ---------- Navegação ----------

function navigate(view) {
    state.view = view;
    state.erroForm = '';
    if (view === 'landing') state.vagasPublicas = null;  // recarrega as vagas a cada visita
    render();
    window.scrollTo(0, 0);
}

function irParaPainel() {
    if (state.tipo === 'jovem') {
        navigate('painel-jovem');
        carregarPainelJovem();
    } else {
        navigate('painel-empresa');
        carregarPainelEmpresa();
    }
}

async function entrar(token, tipo) {
    state.token = token;
    state.tipo = tipo;
    state.usuario = await api(tipo === 'jovem' ? '/jovens/me' : '/empresas/me');
    salvarSessao();
    irParaPainel();
}

function limparEstado() {
    state.token = null;
    state.tipo = null;
    state.usuario = null;
    state.jovem = {aba: 'vagas', recomendacoes: null, candidaturas: null, busca: '', resultadosBusca: null, conversaAtiva: 0, videoUrl: null, empresaAberta: null};
    state.empresa = estadoEmpresaInicial();
}

function sair() {
    limparEstado();
    limparSessao();
    navigate('landing');
}

// ---------- Tema claro/escuro ----------

const TEMA_KEY = 'empregae_tema';

function temaAtual() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function alternarTema() {
    const novo = temaAtual() === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem(TEMA_KEY, novo); } catch (e) {}
    render();
}

function render() {
    const app = document.getElementById('app');
    const views = {
        'landing': renderLanding,
        'login': renderLogin,
        'cadastro-jovem': renderCadastroJovem,
        'cadastro-empresa': renderCadastroEmpresa,
        'painel-jovem': renderPainelJovem,
        'painel-empresa': renderPainelEmpresa,
    };
    app.innerHTML = renderNavbar() + `<main>${(views[state.view] || renderLanding)()}</main>` + renderFooter();
    if (window.lucide) lucide.createIcons();
    if (state.view === 'landing' && state.vagasPublicas === null) carregarVagasPublicas();
}

function renderNavbar() {
    const direita = state.usuario ? `
        <span class="nav-user">Olá, <strong>${esc(state.usuario.nome)}</strong></span>
        <button class="btn btn-ghost btn-sm" onclick="sair()"><i data-lucide="log-out"></i> Sair</button>
    ` : `
        <button class="btn btn-ghost btn-sm" onclick="navigate('login')">Entrar</button>
        <button class="btn btn-primary btn-sm" onclick="navigate('cadastro-jovem')">Criar conta</button>
    `;
    const claro = temaAtual() === 'light';
    const botaoTema = `
        <button class="btn btn-ghost btn-sm btn-icon" onclick="alternarTema()"
            aria-label="${claro ? 'Ativar tema escuro' : 'Ativar tema claro'}" title="${claro ? 'Tema escuro' : 'Tema claro'}">
            <i data-lucide="${claro ? 'moon' : 'sun'}"></i>
        </button>
    `;
    return `
        <nav class="navbar">
            <button class="logo" onclick="${state.usuario ? 'irParaPainel()' : "navigate('landing')"}">
                <i data-lucide="briefcase"></i> Empregae
            </button>
            <div class="row">${botaoTema}${direita}</div>
        </nav>
    `;
}

function renderFooter() {
    return `
        <footer class="footer">
            Empregae · Conectando jovens aprendizes e empresas · Lei da Aprendizagem (Lei nº 10.097/2000)
        </footer>
    `;
}

// ---------- Início: restaura a sessão salva, se houver ----------

async function iniciarSessao() {
    limparEstado();
    const sessao = lerSessao();
    if (sessao && sessao.token) {
        try {
            await entrar(sessao.token, sessao.tipo);
            return;
        } catch (e) {
            sair();
            return;
        }
    }
    navigate('landing');
}

window.onload = iniciarSessao;

// Mantém as abas abertas sincronizadas: entrar, sair ou trocar de conta (ou de tema)
// em uma aba atualiza as outras.
window.addEventListener('storage', (e) => {
    if (e.key === SESSAO_KEY) {
        iniciarSessao();
    } else if (e.key === TEMA_KEY && e.newValue) {
        document.documentElement.dataset.theme = e.newValue;
        render();
    }
});
