// ==========================================================
// Empregae — frontend (HTML/CSS/JS puro)
// ==========================================================

const API_URL = '';
const SESSAO_KEY = 'empregae_sessao';

const state = {
    view: 'landing',
    token: null,
    tipo: null,          // 'jovem' ou 'empresa'
    usuario: null,       // perfil devolvido pela API
    loginTipo: 'jovem',
    erroForm: '',
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

// ---------- Utilidades ----------

function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

function toast(mensagem, erro = false) {
    const el = document.getElementById('toast');
    el.textContent = mensagem;
    el.className = 'toast show' + (erro ? ' erro' : '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.className = 'toast', 3500);
}

function formatarData(iso) {
    if (!iso) return '';
    const [ano, mes, dia] = iso.slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
}

function iniciais(nome) {
    return (nome || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

// ---------- Sessão (fica salva no navegador) ----------

function salvarSessao() {
    try { localStorage.setItem(SESSAO_KEY, JSON.stringify({token: state.token, tipo: state.tipo})); } catch (e) {}
}

function lerSessao() {
    try { return JSON.parse(localStorage.getItem(SESSAO_KEY)); } catch (e) { return null; }
}

function limparSessao() {
    try { localStorage.removeItem(SESSAO_KEY); } catch (e) {}
}

// ---------- Comunicação com a API ----------

const NOMES_CAMPOS = {
    nome: 'Nome', email: 'E-mail', senha: 'Senha', descricao: 'Descrição', titulo: 'Título',
    cnpj: 'CNPJ', total_funcionarios: 'Total de funcionários', data_nascimento: 'Data de nascimento', cidade: 'Cidade',
};

function mensagemDeErro(dados) {
    const detalhe = dados && dados.detail;
    if (typeof detalhe === 'string') return detalhe;
    if (Array.isArray(detalhe) && detalhe.length) {
        const erro = detalhe[0];
        const campo = NOMES_CAMPOS[erro.loc[erro.loc.length - 1]] || 'Campo';
        if (erro.type === 'string_too_short') return `${campo} deve ter pelo menos ${erro.ctx.min_length} caracteres.`;
        if (erro.type === 'value_error') return erro.msg.replace('Value error, ', '');
        if (erro.type === 'greater_than_equal') return `${campo} não pode ser negativo.`;
        if (erro.type === 'missing') return `${campo} é obrigatório.`;
        return `${campo}: valor inválido.`;
    }
    return 'Algo deu errado. Tente novamente.';
}

async function api(caminho, {method = 'GET', body, form} = {}) {
    const headers = {};
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    let payload;
    if (form) {
        payload = form;
    } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(API_URL + caminho, {method, headers, body: payload});
    } catch (e) {
        throw new Error('Não foi possível conectar ao servidor. Verifique se a API está rodando.');
    }
    const dados = await res.json().catch(() => null);
    if (!res.ok) {
        if (res.status === 401 && state.token) {
            sair();
            toast('Sua sessão expirou. Entre novamente.', true);
        }
        throw new Error(mensagemDeErro(dados));
    }
    return dados;
}

// Arquivos protegidos (currículo/vídeo) precisam do token, então são baixados via fetch.
async function abrirArquivo(caminho) {
    const res = await fetch(API_URL + caminho, {headers: {'Authorization': 'Bearer ' + state.token}});
    if (!res.ok) throw new Error('Arquivo não encontrado.');
    return URL.createObjectURL(await res.blob());
}

// Abre currículo/vídeo em nova aba. A aba é aberta já no clique (antes do download)
// para o navegador não bloquear como pop-up.
async function abrirEmNovaAba(caminho) {
    const aba = window.open('', '_blank');
    try {
        const url = await abrirArquivo(caminho);
        if (aba) aba.location.href = url; else window.open(url, '_blank');
    } catch (err) {
        if (aba) aba.close();
        toast(err.message, true);
    }
}

// ---------- Navegação ----------

function navigate(view) {
    state.view = view;
    state.erroForm = '';
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

// ==========================================================
// Semana 5 — Landing page, login e cadastro
// ==========================================================

function renderLanding() {
    return `
        <section class="hero">
            <span class="badge badge-primary hero-tag"><i data-lucide="scale"></i> Lei da Aprendizagem · Lei nº 10.097/2000</span>
            <h1>Seu primeiro emprego <span class="gradient-text">começa aqui</span></h1>
            <p class="lead">
                O Empregae conecta jovens aprendizes a empresas que precisam cumprir a cota obrigatória de aprendizagem,
                usando um filtro inteligente que encontra as vagas mais compatíveis com o seu perfil.
            </p>
            <div class="row">
                <button class="btn btn-primary btn-lg" onclick="navigate('cadastro-jovem')"><i data-lucide="graduation-cap"></i> Sou jovem aprendiz</button>
                <button class="btn btn-ghost btn-lg" onclick="navigate('cadastro-empresa')"><i data-lucide="building-2"></i> Sou empresa</button>
            </div>
            <p class="muted small" style="margin-top: 1.25rem;">Já tem conta? <button class="link-btn" onclick="navigate('login')">Entrar</button></p>
        </section>

        <section class="section">
            <div class="section-title">
                <h2>Como funciona</h2>
                <p>Em três passos, jovens encontram oportunidades e empresas encontram talentos.</p>
            </div>
            <div class="grid-3">
                <div class="glass-panel step">
                    <div class="step-icon"><i data-lucide="user-plus"></i></div>
                    <h3>1. Crie seu perfil</h3>
                    <p>Conte quais são suas habilidades e interesses. Envie seu currículo e um vídeo de apresentação.</p>
                </div>
                <div class="glass-panel step">
                    <div class="step-icon"><i data-lucide="sparkles"></i></div>
                    <h3>2. Filtro inteligente</h3>
                    <p>Comparamos seu perfil com a descrição de cada vaga e mostramos as mais compatíveis primeiro.</p>
                </div>
                <div class="glass-panel step">
                    <div class="step-icon"><i data-lucide="handshake"></i></div>
                    <h3>3. Conecte-se</h3>
                    <p>Candidate-se com um clique e acompanhe o status. As empresas veem os candidatos que dão match.</p>
                </div>
            </div>
        </section>

        <section class="section">
            <div class="grid-2">
                <div class="glass-panel audience">
                    <h3><i data-lucide="graduation-cap"></i> Para jovens aprendizes</h3>
                    <ul>
                        <li><i data-lucide="check"></i> Vagas recomendadas de acordo com o seu perfil</li>
                        <li><i data-lucide="check"></i> Currículo e vídeo de apresentação em um só lugar</li>
                        <li><i data-lucide="check"></i> Acompanhe suas candidaturas em tempo real</li>
                        <li><i data-lucide="check"></i> Seus dados protegidos de acordo com a LGPD</li>
                    </ul>
                    <button class="btn btn-primary btn-block" onclick="navigate('cadastro-jovem')">Criar meu perfil</button>
                </div>
                <div class="glass-panel audience">
                    <h3><i data-lucide="building-2"></i> Para empresas</h3>
                    <ul>
                        <li><i data-lucide="check"></i> Cálculo automático da cota de aprendizes</li>
                        <li><i data-lucide="check"></i> Candidatos ordenados por compatibilidade com a vaga</li>
                        <li><i data-lucide="check"></i> Publique e gerencie vagas em poucos minutos</li>
                        <li><i data-lucide="check"></i> Acompanhe quantas vagas da cota já foram preenchidas</li>
                    </ul>
                    <button class="btn btn-secondary btn-block" onclick="navigate('cadastro-empresa')">Cadastrar empresa</button>
                </div>
            </div>
        </section>

        <section class="section">
            <div class="section-title">
                <h2>A Lei da Aprendizagem</h2>
                <p>Empresas de médio e grande porte devem contratar jovens aprendizes. Veja o essencial.</p>
            </div>
            <div class="grid-3">
                <div class="glass-panel fact">
                    <strong class="gradient-text">14 a 24 anos</strong>
                    <p>Idade do jovem aprendiz (sem limite de idade para pessoas com deficiência).</p>
                </div>
                <div class="glass-panel fact">
                    <strong class="gradient-text">5% a 15%</strong>
                    <p>Cota de aprendizes sobre os funcionários em funções que exigem formação profissional.</p>
                </div>
                <div class="glass-panel fact">
                    <strong class="gradient-text">Até 2 anos</strong>
                    <p>Duração máxima do contrato de aprendizagem, com formação teórica e prática.</p>
                </div>
            </div>
        </section>

        <section class="section cta-final">
            <div class="glass-panel">
                <h2>Pronto para começar?</h2>
                <p class="muted">Cadastre-se gratuitamente e encontre a conexão certa.</p>
                <div class="row">
                    <button class="btn btn-primary" onclick="navigate('cadastro-jovem')">Sou jovem aprendiz</button>
                    <button class="btn btn-ghost" onclick="navigate('cadastro-empresa')">Sou empresa</button>
                </div>
            </div>
        </section>
    `;
}

function renderErroForm() {
    return state.erroForm ? `<div class="alert alert-error"><i data-lucide="alert-circle"></i><span>${esc(state.erroForm)}</span></div>` : '';
}

function mostrarErroForm(mensagem) {
    state.erroForm = mensagem;
    const el = document.getElementById('erro_form');
    if (el) {
        el.innerHTML = renderErroForm();
        if (window.lucide) lucide.createIcons();
        el.scrollIntoView({block: 'center', behavior: 'smooth'});
    }
}

function travarBotao(form, travar, texto) {
    const botao = form.querySelector('button[type="submit"]');
    if (!botao) return;
    if (travar) {
        botao.dataset.texto = botao.innerHTML;
        botao.innerHTML = texto;
        botao.disabled = true;
    } else {
        botao.innerHTML = botao.dataset.texto;
        botao.disabled = false;
    }
}

function renderLogin() {
    const tipo = state.loginTipo;
    return `
        <div class="container-narrow">
            <div class="glass-panel">
                <div class="auth-header">
                    <h2>Entrar</h2>
                    <p class="muted">Acesse sua conta no Empregae</p>
                </div>
                <div class="segmented" role="tablist">
                    <button class="${tipo === 'jovem' ? 'active' : ''}" onclick="trocarTipoLogin('jovem')"><i data-lucide="graduation-cap"></i> Jovem</button>
                    <button class="${tipo === 'empresa' ? 'active' : ''}" onclick="trocarTipoLogin('empresa')"><i data-lucide="building-2"></i> Empresa</button>
                </div>
                <div id="erro_form">${renderErroForm()}</div>
                <form onsubmit="handleLogin(event)">
                    <div class="form-group">
                        <label for="login_email">E-mail</label>
                        <input type="email" id="login_email" class="form-control" autocomplete="email" required>
                    </div>
                    <div class="form-group">
                        <label for="login_senha">Senha</label>
                        <input type="password" id="login_senha" class="form-control" autocomplete="current-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Entrar</button>
                </form>
                <p class="auth-footer">
                    Ainda não tem conta?
                    <button class="link-btn" onclick="navigate('${tipo === 'jovem' ? 'cadastro-jovem' : 'cadastro-empresa'}')">Cadastre-se</button>
                </p>
            </div>
        </div>
    `;
}

function trocarTipoLogin(tipo) {
    const email = document.getElementById('login_email').value;
    state.loginTipo = tipo;
    state.erroForm = '';
    render();
    document.getElementById('login_email').value = email;
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    travarBotao(form, true, 'Entrando...');
    try {
        const res = await api('/login', {method: 'POST', body: {
            email: document.getElementById('login_email').value,
            senha: document.getElementById('login_senha').value,
            tipo: state.loginTipo,
        }});
        await entrar(res.token, res.tipo);
    } catch (err) {
        travarBotao(form, false);
        mostrarErroForm(err.message);
    }
}

function renderCadastroJovem() {
    return `
        <div class="container-narrow">
            <div class="glass-panel">
                <div class="auth-header">
                    <h2>Cadastro de Jovem Aprendiz</h2>
                    <p class="muted">Crie seu perfil e receba vagas compatíveis com você</p>
                </div>
                <div id="erro_form">${renderErroForm()}</div>
                <form onsubmit="handleRegisterApprentice(event)">
                    <div class="form-group">
                        <label for="app_name">Nome completo</label>
                        <input type="text" id="app_name" class="form-control" autocomplete="name" required>
                    </div>
                    <div class="form-group">
                        <label for="app_email">E-mail</label>
                        <input type="email" id="app_email" class="form-control" autocomplete="email" required>
                    </div>
                    <div class="form-group">
                        <label for="app_password">Senha</label>
                        <input type="password" id="app_password" class="form-control" autocomplete="new-password" minlength="6" required>
                        <p class="hint">Mínimo de 6 caracteres.</p>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="app_nascimento">Data de nascimento <span class="optional">(opcional)</span></label>
                            <input type="date" id="app_nascimento" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="app_cidade">Cidade <span class="optional">(opcional)</span></label>
                            <input type="text" id="app_cidade" class="form-control" placeholder="Ex: Recife - PE">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="app_desc">Sobre você</label>
                        <textarea id="app_desc" class="form-control" rows="4" required
                            placeholder="Ex: Gosto de organizar documentos, tenho facilidade com computador e quero trabalhar na área administrativa."></textarea>
                        <p class="hint">Conte suas habilidades, interesses e o que busca. Quanto mais detalhes, melhores as recomendações.</p>
                    </div>
                    <div class="alert alert-info"><i data-lucide="info"></i><span>Depois do cadastro, você poderá enviar seu currículo e um vídeo de apresentação.</span></div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="lgpd" required>
                        <label for="lgpd">Declaro estar ciente e de acordo com o tratamento dos meus dados pessoais conforme a LGPD (Lei nº 13.709/2018).</label>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="lei" required>
                        <label for="lei">Estou ciente das regras da Lei da Aprendizagem (Lei nº 10.097/2000).</label>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Criar meu perfil</button>
                </form>
                <p class="auth-footer">Já tem conta? <button class="link-btn" onclick="state.loginTipo='jovem'; navigate('login')">Entrar</button></p>
            </div>
        </div>
    `;
}

async function handleRegisterApprentice(e) {
    e.preventDefault();
    const form = e.target;
    travarBotao(form, true, 'Criando perfil...');
    try {
        const res = await api('/jovens/', {method: 'POST', body: {
            nome: document.getElementById('app_name').value.trim(),
            email: document.getElementById('app_email').value,
            senha: document.getElementById('app_password').value,
            data_nascimento: document.getElementById('app_nascimento').value || null,
            cidade: document.getElementById('app_cidade').value.trim() || null,
            descricao: document.getElementById('app_desc').value.trim(),
            aceitou_lgpd: document.getElementById('lgpd').checked,
            aceitou_lei_aprendizagem: document.getElementById('lei').checked,
        }});
        await entrar(res.token, 'jovem');
        toast('Perfil criado! Bem-vindo(a) ao Empregae.');
    } catch (err) {
        travarBotao(form, false);
        mostrarErroForm(err.message);
    }
}

function renderCadastroEmpresa() {
    return `
        <div class="container-narrow">
            <div class="glass-panel">
                <div class="auth-header">
                    <h2>Cadastro de Empresa</h2>
                    <p class="muted">Encontre aprendizes e acompanhe o cumprimento da cota</p>
                </div>
                <div id="erro_form">${renderErroForm()}</div>
                <form onsubmit="handleRegisterCompany(event)">
                    <div class="form-group">
                        <label for="comp_name">Nome da empresa</label>
                        <input type="text" id="comp_name" class="form-control" autocomplete="organization" required>
                    </div>
                    <div class="form-group">
                        <label for="comp_cnpj">CNPJ <span class="optional">(opcional)</span></label>
                        <input type="text" id="comp_cnpj" class="form-control" placeholder="00.000.000/0000-00" inputmode="numeric">
                    </div>
                    <div class="form-group">
                        <label for="comp_email">E-mail corporativo</label>
                        <input type="email" id="comp_email" class="form-control" autocomplete="email" required>
                    </div>
                    <div class="form-group">
                        <label for="comp_password">Senha</label>
                        <input type="password" id="comp_password" class="form-control" autocomplete="new-password" minlength="6" required>
                        <p class="hint">Mínimo de 6 caracteres.</p>
                    </div>
                    <div class="form-group">
                        <label for="comp_funcionarios">Funcionários em funções que exigem formação profissional <span class="optional">(opcional)</span></label>
                        <input type="number" id="comp_funcionarios" class="form-control" min="0" placeholder="Ex: 50">
                        <p class="hint">Usado para calcular sua cota de aprendizes (5% a 15%).</p>
                    </div>
                    <button type="submit" class="btn btn-secondary btn-block">Cadastrar empresa</button>
                </form>
                <p class="auth-footer">Já tem conta? <button class="link-btn" onclick="state.loginTipo='empresa'; navigate('login')">Entrar</button></p>
            </div>
        </div>
    `;
}

async function handleRegisterCompany(e) {
    e.preventDefault();
    const form = e.target;
    const funcionarios = document.getElementById('comp_funcionarios').value;
    travarBotao(form, true, 'Cadastrando...');
    try {
        const res = await api('/empresas/', {method: 'POST', body: {
            nome: document.getElementById('comp_name').value.trim(),
            cnpj: document.getElementById('comp_cnpj').value.trim() || null,
            email: document.getElementById('comp_email').value,
            senha: document.getElementById('comp_password').value,
            total_funcionarios: funcionarios === '' ? null : Number(funcionarios),
        }});
        await entrar(res.token, 'empresa');
        toast('Empresa cadastrada com sucesso!');
    } catch (err) {
        travarBotao(form, false);
        mostrarErroForm(err.message);
    }
}

// ==========================================================
// Semana 6 — Painel do Jovem Aprendiz
// ==========================================================

const STATUS_CANDIDATURA = {
    pendente: ['Enviada', 'badge-warning', 'clock'],
    em_analise: ['Em análise', 'badge-info', 'search'],
    contratado: ['Contratado(a)!', 'badge-success', 'party-popper'],
    recusado: ['Não selecionado', 'badge-danger', 'x-circle'],
};

function itensPerfil(u) {
    return [
        ['Descrição detalhada', (u.descricao || '').length >= 40],
        ['Cidade', !!u.cidade],
        ['Data de nascimento', !!u.data_nascimento],
        ['Currículo em PDF', !!u.curriculo_url],
        ['Vídeo de apresentação', !!u.video_url],
    ];
}

async function carregarPainelJovem() {
    const token = state.token;
    try {
        const [recomendacoes, candidaturas] = await Promise.all([
            api('/jovens/me/recomendacoes'),
            api('/jovens/me/candidaturas'),
        ]);
        if (state.token !== token) return;  // trocou de conta enquanto carregava
        state.jovem.recomendacoes = recomendacoes;
        state.jovem.candidaturas = candidaturas;
    } catch (err) {
        state.jovem.recomendacoes = state.jovem.recomendacoes || [];
        state.jovem.candidaturas = state.jovem.candidaturas || [];
        toast(err.message, true);
    }
    if (state.view === 'painel-jovem') render();
}

function trocarAbaJovem(aba) {
    state.jovem.aba = aba;
    state.jovem.empresaAberta = null;
    render();
}

function renderPainelJovem() {
    const u = state.usuario;
    const itens = itensPerfil(u);
    const pct = Math.round(itens.filter(i => i[1]).length / itens.length * 100);
    const nCandidaturas = state.jovem.candidaturas ? state.jovem.candidaturas.length : 0;
    const abas = [
        ['vagas', 'sparkles', 'Vagas para você', 'Vagas', ''],
        ['candidaturas', 'send', 'Minhas candidaturas', 'Candidaturas', nCandidaturas ? `<span class="count">${nCandidaturas}</span>` : ''],
        ['mensagens', 'message-square', 'Mensagens', 'Mensagens', ''],
        ['perfil', 'user', 'Meu perfil', 'Perfil', ''],
    ];
    const conteudo = state.jovem.empresaAberta ? renderPerfilEmpresa() : {
        vagas: renderAbaVagas,
        candidaturas: renderAbaCandidaturas,
        mensagens: renderAbaMensagens,
        perfil: renderAbaPerfil,
    }[state.jovem.aba]();

    return `
        <div class="container">
            <div class="dash-header">
                <div>
                    <h2>Olá, ${esc(u.nome.split(' ')[0])}!</h2>
                    <p class="muted">Encontre vagas de jovem aprendiz compatíveis com o seu perfil.</p>
                </div>
                <div class="completude">
                    <div class="row-between small"><span>Perfil ${pct}% completo</span>
                        ${pct < 100 ? `<button class="link-btn small" onclick="trocarAbaJovem('perfil')">Completar</button>` : '<i data-lucide="badge-check"></i>'}
                    </div>
                    <div class="progress" style="margin-top: 6px;"><span style="width: ${pct}%"></span></div>
                </div>
            </div>
            <nav class="tabs">
                ${abas.map(([id, icone, nome, nomeCurto, extra]) => `
                    <button class="tab ${state.jovem.aba === id ? 'active' : ''}" onclick="trocarAbaJovem('${id}')">
                        <i data-lucide="${icone}"></i> <span class="nome-longo">${nome}</span><span class="nome-curto">${nomeCurto}</span> ${extra}
                    </button>
                `).join('')}
            </nav>
            ${conteudo}
        </div>
    `;
}

// ---------- Aba: vagas ----------

function renderAbaVagas() {
    const j = state.jovem;
    const buscando = j.resultadosBusca !== null;
    let lista;
    if (buscando) {
        lista = j.resultadosBusca.length
            ? j.resultadosBusca.map(v => renderVagaCard(v, null)).join('')
            : renderVazio('search-x', `Nenhuma vaga encontrada para "${esc(j.busca)}".`);
    } else if (j.recomendacoes === null) {
        lista = renderVazio('loader', 'Analisando seu perfil para encontrar as melhores vagas...');
    } else if (!j.recomendacoes.length) {
        lista = renderVazio('briefcase', 'Ainda não há vagas abertas. Volte em breve!');
    } else {
        lista = j.recomendacoes.map(v => renderVagaCard(v, v.compatibilidade)).join('');
    }

    return `
        <form class="search-bar" onsubmit="buscarVagas(event)">
            <input type="search" id="busca_vagas" class="form-control" placeholder="Buscar por cargo, palavra-chave ou empresa..." value="${esc(j.busca)}">
            <button type="submit" class="btn btn-primary"><i data-lucide="search"></i> <span>Buscar</span></button>
        </form>
        <div class="row-between" style="margin-bottom: 1rem;">
            <h3 style="margin: 0;">${buscando ? `Resultados para "${esc(j.busca)}"` : 'Recomendadas pelo Filtro Inteligente'}</h3>
            ${buscando ? `<button class="btn btn-ghost btn-sm" onclick="limparBusca()"><i data-lucide="x"></i> Limpar busca</button>` : ''}
        </div>
        ${lista}
    `;
}

function renderVazio(icone, texto) {
    return `<div class="card empty-state"><i data-lucide="${icone}"></i><p>${texto}</p></div>`;
}

function jaCandidatou(vagaId) {
    return (state.jovem.candidaturas || []).some(c => c.vaga.id === vagaId);
}

function renderVagaCard(vaga, compatibilidade) {
    const candidatou = jaCandidatou(vaga.id);
    return `
        <article class="card card-hover vaga-card">
            <div class="row-between">
                <h4>${esc(vaga.titulo)}</h4>
                ${compatibilidade !== null && compatibilidade >= 50 ? '<span class="badge badge-success"><i data-lucide="flame"></i> Alta compatibilidade</span>' : ''}
            </div>
            <div class="meta">
                <span><i data-lucide="building-2"></i> ${linkEmpresa(vaga.empresa_id, vaga.empresa_nome)}</span>
            </div>
            <p class="descricao">${esc(vaga.descricao)}</p>
            <div class="rodape">
                ${compatibilidade !== null ? `
                    <div class="compat" title="Compatibilidade calculada pelo Filtro Inteligente">
                        <div class="progress"><span style="width: ${Math.max(compatibilidade, 2)}%"></span></div>
                        <strong>${Math.round(compatibilidade)}% compatível</strong>
                    </div>` : '<span></span>'}
                ${candidatou
                    ? '<button class="btn btn-success-soft btn-sm" disabled><i data-lucide="check"></i> Candidatura enviada</button>'
                    : `<button class="btn btn-primary btn-sm" onclick="candidatar(${Number(vaga.id)}, this)"><i data-lucide="send"></i> Candidatar-se</button>`}
            </div>
        </article>
    `;
}

async function buscarVagas(e) {
    e.preventDefault();
    const termo = document.getElementById('busca_vagas').value.trim();
    if (!termo) return limparBusca();
    state.jovem.busca = termo;
    try {
        state.jovem.resultadosBusca = await api('/vagas/?busca=' + encodeURIComponent(termo));
        render();
    } catch (err) {
        toast(err.message, true);
    }
}

function limparBusca() {
    state.jovem.busca = '';
    state.jovem.resultadosBusca = null;
    render();
}

async function candidatar(vagaId, botao) {
    botao.disabled = true;
    try {
        await api(`/vagas/${vagaId}/candidaturas`, {method: 'POST'});
        state.jovem.candidaturas = await api('/jovens/me/candidaturas');
        toast('Candidatura enviada! Acompanhe em "Minhas candidaturas".');
        render();
    } catch (err) {
        botao.disabled = false;
        toast(err.message, true);
    }
}

// ---------- Perfil público da empresa ----------

function linkEmpresa(id, nome) {
    return `<button class="link-btn" onclick="abrirPerfilEmpresa(${Number(id)})" title="Ver perfil da empresa">${esc(nome)}</button>`;
}

async function abrirPerfilEmpresa(empresaId) {
    try {
        state.jovem.empresaAberta = await api(`/empresas/${empresaId}/perfil`);
        render();
        window.scrollTo(0, 0);
    } catch (err) {
        toast(err.message, true);
    }
}

function fecharPerfilEmpresa() {
    state.jovem.empresaAberta = null;
    render();
}

function renderPerfilEmpresa() {
    const e = state.jovem.empresaAberta;
    const siteSeguro = e.site && /^https?:\/\//i.test(e.site);
    return `
        <button class="btn btn-ghost btn-sm" onclick="fecharPerfilEmpresa()" style="margin-bottom: 1rem;"><i data-lucide="arrow-left"></i> Voltar</button>
        <div class="glass-panel" style="margin-bottom: 1.5rem;">
            <div class="candidato-topo">
                <div class="avatar avatar-lg">${iniciais(e.nome)}</div>
                <div class="candidato-info">
                    <h2 style="margin-bottom: 0.25rem;">${esc(e.nome)}</h2>
                    <div class="meta">
                        ${e.area_atuacao ? `<span><i data-lucide="tag"></i> ${esc(e.area_atuacao)}</span>` : ''}
                        ${e.cidade ? `<span><i data-lucide="map-pin"></i> ${esc(e.cidade)}</span>` : ''}
                        ${siteSeguro ? `<span><i data-lucide="globe"></i> <a href="${esc(e.site)}" target="_blank" rel="noopener noreferrer">${esc(e.site.replace(/^https?:\/\//i, ''))}</a></span>` : ''}
                    </div>
                </div>
            </div>
            <p style="margin-top: 0.5rem; white-space: pre-line;" class="${e.descricao ? '' : 'muted'}">${e.descricao ? esc(e.descricao) : 'Esta empresa ainda não escreveu uma apresentação.'}</p>
        </div>
        <h3>Vagas abertas (${e.vagas_abertas.length})</h3>
        ${e.vagas_abertas.length
            ? e.vagas_abertas.map(v => renderVagaCard(v, null)).join('')
            : renderVazio('briefcase', 'Nenhuma vaga aberta no momento.')}
    `;
}

// ---------- Aba: candidaturas ----------

function renderAbaCandidaturas() {
    const lista = state.jovem.candidaturas;
    if (lista === null) return renderVazio('loader', 'Carregando suas candidaturas...');
    if (!lista.length) {
        return `
            <div class="card empty-state">
                <i data-lucide="send"></i>
                <p>Você ainda não se candidatou a nenhuma vaga.</p>
                <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="trocarAbaJovem('vagas')">Ver vagas recomendadas</button>
            </div>
        `;
    }
    return lista.map(c => {
        const [rotulo, classe, icone] = STATUS_CANDIDATURA[c.status] || [c.status, 'badge-neutral', 'circle'];
        return `
            <article class="card vaga-card">
                <div class="row-between">
                    <h4>${esc(c.vaga.titulo)}</h4>
                    <span class="badge ${classe}"><i data-lucide="${icone}"></i> ${rotulo}</span>
                </div>
                <div class="meta">
                    <span><i data-lucide="building-2"></i> ${linkEmpresa(c.vaga.empresa_id, c.vaga.empresa_nome)}</span>
                    <span><i data-lucide="calendar"></i> Enviada em ${formatarData(c.criado_em)}</span>
                    ${c.vaga.aberta ? '' : '<span><i data-lucide="lock"></i> Vaga encerrada</span>'}
                </div>
            </article>
        `;
    }).join('');
}

// ---------- Aba: mensagens (mockup) ----------

const CONVERSAS_EXEMPLO = [
    {empresa: 'Empresa Exemplo', vaga: 'Assistente Administrativo', mensagens: [
        ['recebida', 'Olá! Vimos seu perfil e gostamos muito da sua descrição. Você tem disponibilidade no período da tarde?', '10:02'],
        ['enviada', 'Olá! Tenho sim, estudo de manhã e fico livre a partir das 13h.', '10:15'],
        ['recebida', 'Ótimo! Vamos agendar uma conversa na próxima semana. Enviaremos os detalhes por aqui.', '10:20'],
    ]},
    {empresa: 'Loja Modelo', vaga: 'Auxiliar de Vendas', mensagens: [
        ['recebida', 'Oi! Sua candidatura foi recebida. Em breve entraremos em contato.', 'Ontem'],
    ]},
    {empresa: 'Indústria Demonstração', vaga: 'Auxiliar de Logística', mensagens: [
        ['recebida', 'Obrigado pelo interesse! Poderia nos enviar seu vídeo de apresentação?', 'Seg'],
        ['enviada', 'Claro! Acabei de adicionar no meu perfil.', 'Seg'],
    ]},
];

function renderAbaMensagens() {
    const ativa = CONVERSAS_EXEMPLO[state.jovem.conversaAtiva];
    return `
        <div class="alert alert-info"><i data-lucide="construction"></i>
            <span><strong>Prévia do chat.</strong> As conversas abaixo são exemplos para demonstrar a tela; o envio de mensagens será ativado em uma próxima versão.</span>
        </div>
        <div class="chat">
            <div class="chat-list">
                ${CONVERSAS_EXEMPLO.map((c, i) => `
                    <button class="chat-item ${i === state.jovem.conversaAtiva ? 'active' : ''}" onclick="state.jovem.conversaAtiva = ${i}; render();">
                        <div class="avatar">${iniciais(c.empresa)}</div>
                        <div class="info">
                            <div class="row-between"><strong class="small">${esc(c.empresa)}</strong><span class="muted small">${c.mensagens[c.mensagens.length - 1][2]}</span></div>
                            <div class="preview">${esc(c.mensagens[c.mensagens.length - 1][1])}</div>
                        </div>
                    </button>
                `).join('')}
            </div>
            <div class="chat-thread">
                <div class="chat-thread-header">
                    <div class="avatar">${iniciais(ativa.empresa)}</div>
                    <div><strong>${esc(ativa.empresa)}</strong><div class="muted small">${esc(ativa.vaga)}</div></div>
                </div>
                <div class="chat-messages">
                    ${ativa.mensagens.map(([tipo, texto, hora]) => `<div class="bubble ${tipo}">${esc(texto)}<small>${hora}</small></div>`).join('')}
                </div>
                <form class="chat-input" onsubmit="event.preventDefault(); toast('O envio de mensagens ainda não está disponível.');">
                    <input type="text" class="form-control" placeholder="Escreva uma mensagem..." disabled>
                    <button type="submit" class="btn btn-primary" title="Enviar"><i data-lucide="send"></i></button>
                </form>
            </div>
        </div>
    `;
}

// ---------- Aba: perfil ----------

function renderAbaPerfil() {
    const u = state.usuario;
    const itens = itensPerfil(u);
    return `
        <div class="grid-2">
            <div class="glass-panel">
                <h3>Meus dados</h3>
                <div id="erro_form">${renderErroForm()}</div>
                <form onsubmit="salvarPerfilJovem(event)">
                    <div class="form-group">
                        <label for="perfil_nome">Nome completo</label>
                        <input type="text" id="perfil_nome" class="form-control" value="${esc(u.nome)}" required>
                    </div>
                    <div class="form-group">
                        <label>E-mail</label>
                        <input type="email" class="form-control" value="${esc(u.email)}" disabled>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="perfil_nascimento">Data de nascimento</label>
                            <input type="date" id="perfil_nascimento" class="form-control" value="${esc(u.data_nascimento || '')}">
                        </div>
                        <div class="form-group">
                            <label for="perfil_cidade">Cidade</label>
                            <input type="text" id="perfil_cidade" class="form-control" value="${esc(u.cidade || '')}" placeholder="Ex: Recife - PE">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="perfil_desc">Sobre você</label>
                        <textarea id="perfil_desc" class="form-control" rows="5">${esc(u.descricao || '')}</textarea>
                        <p class="hint">O Filtro Inteligente usa este texto para recomendar vagas.</p>
                    </div>
                    <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Salvar alterações</button>
                </form>
            </div>
            <div class="stack">
                <div class="glass-panel">
                    <h3>Currículo e vídeo</h3>
                    ${renderArquivo('curriculo', 'file-text', 'Currículo', 'PDF de até 5 MB', u.curriculo_url, 'application/pdf')}
                    ${renderArquivo('video', 'video', 'Vídeo de apresentação', 'MP4, WebM ou MOV de até 50 MB', u.video_url, 'video/mp4,video/webm,video/quicktime')}
                    ${state.jovem.videoUrl ? `<video class="video-preview" src="${state.jovem.videoUrl}" controls></video>` : ''}
                </div>
                <div class="glass-panel">
                    <h3>Perfil completo</h3>
                    <p class="muted small">Perfis completos chamam mais atenção das empresas.</p>
                    <ul class="checklist">
                        ${itens.map(([nome, ok]) => `<li class="${ok ? 'ok' : ''}"><i data-lucide="${ok ? 'check-circle-2' : 'circle'}"></i> ${nome}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;
}

function renderArquivo(tipo, icone, titulo, formatos, url, accept) {
    return `
        <div class="file-box">
            <div class="file-icon"><i data-lucide="${icone}"></i></div>
            <div class="file-info">
                <strong>${titulo}</strong>
                <div class="small ${url ? '' : 'muted'}">${url ? '<span class="badge badge-success"><i data-lucide="check"></i> Enviado</span>' : formatos}</div>
            </div>
            <div class="row">
                ${url ? `<button class="btn btn-ghost btn-sm" onclick="verArquivo('${tipo}')"><i data-lucide="eye"></i> Ver</button>` : ''}
                <label class="btn btn-primary btn-sm" for="upload_${tipo}"><i data-lucide="upload"></i> ${url ? 'Trocar' : 'Enviar'}</label>
                <input type="file" id="upload_${tipo}" accept="${accept}" onchange="enviarArquivo('${tipo}', this)">
            </div>
        </div>
    `;
}

async function salvarPerfilJovem(e) {
    e.preventDefault();
    const form = e.target;
    travarBotao(form, true, 'Salvando...');
    try {
        state.usuario = await api('/jovens/me', {method: 'PATCH', body: {
            nome: document.getElementById('perfil_nome').value.trim(),
            data_nascimento: document.getElementById('perfil_nascimento').value || null,
            cidade: document.getElementById('perfil_cidade').value.trim() || null,
            descricao: document.getElementById('perfil_desc').value.trim(),
        }});
        state.erroForm = '';
        state.jovem.recomendacoes = await api('/jovens/me/recomendacoes');
        toast('Perfil atualizado! As recomendações foram recalculadas.');
        render();
    } catch (err) {
        travarBotao(form, false);
        mostrarErroForm(err.message);
    }
}

async function enviarArquivo(tipo, input) {
    const arquivo = input.files[0];
    if (!arquivo) return;
    const form = new FormData();
    form.append('arquivo', arquivo);
    toast('Enviando arquivo...');
    try {
        await api(`/jovens/me/${tipo}`, {method: 'POST', form});
        state.usuario = await api('/jovens/me');
        if (tipo === 'video') state.jovem.videoUrl = null;
        toast(tipo === 'video' ? 'Vídeo enviado com sucesso!' : 'Currículo enviado com sucesso!');
        render();
    } catch (err) {
        input.value = '';
        toast(err.message, true);
    }
}

async function verArquivo(tipo) {
    try {
        if (tipo === 'curriculo') {
            await abrirEmNovaAba(state.usuario.curriculo_url);
        } else {
            state.jovem.videoUrl = await abrirArquivo(state.usuario.video_url);
            render();
        }
    } catch (err) {
        toast(err.message, true);
    }
}

// ==========================================================
// Semana 7 — Painel da Empresa
// ==========================================================

const STATUS_EMPRESA = {
    pendente: ['Nova', 'badge-warning'],
    em_analise: ['Em análise', 'badge-info'],
    contratado: ['Contratado', 'badge-success'],
    recusado: ['Recusado', 'badge-danger'],
};

function estadoEmpresaInicial() {
    return {
        aba: 'candidaturas',
        candidaturas: null,
        compativeis: null,
        vagas: null,
        cota: null,
        setores: null,       // linhas do organograma sendo editadas
        filtroVaga: 'todas',
        editandoVaga: null,
    };
}

async function carregarPainelEmpresa() {
    const token = state.token;
    try {
        const [candidaturas, compativeis, vagas, cota, organograma] = await Promise.all([
            api('/empresas/me/candidaturas'),
            api('/empresas/me/candidatos'),
            api('/empresas/me/vagas'),
            api('/empresas/me/cota'),
            api('/empresas/me/organograma'),
        ]);
        if (state.token !== token) return;  // trocou de conta enquanto carregava
        Object.assign(state.empresa, {candidaturas, compativeis, vagas, cota});
        state.empresa.setores = organograma.setores.length
            ? organograma.setores.map(s => ({nome: s.nome, funcionarios: s.funcionarios, exige_formacao: s.exige_formacao}))
            : [{nome: '', funcionarios: '', exige_formacao: true}];
    } catch (err) {
        toast(err.message, true);
    }
    if (state.view === 'painel-empresa') render();
}

async function recarregarEmpresa(...partes) {
    const rotas = {
        candidaturas: '/empresas/me/candidaturas',
        compativeis: '/empresas/me/candidatos',
        vagas: '/empresas/me/vagas',
        cota: '/empresas/me/cota',
    };
    const resultados = await Promise.all(partes.map(p => api(rotas[p])));
    partes.forEach((p, i) => state.empresa[p] = resultados[i]);
}

function trocarAbaEmpresa(aba) {
    state.empresa.aba = aba;
    state.erroForm = '';
    render();
}

function renderPainelEmpresa() {
    const e = state.empresa;
    const pendentes = (e.candidaturas || []).filter(c => c.status === 'pendente').length;
    const abertas = (e.vagas || []).filter(v => v.aberta).length;
    const abas = [
        ['candidaturas', 'inbox', 'Candidaturas', 'Recebidas', pendentes ? `<span class="count">${pendentes}</span>` : ''],
        ['compativeis', 'sparkles', 'Candidatos compatíveis', 'Compatíveis', ''],
        ['vagas', 'briefcase', 'Minhas vagas', 'Vagas', abertas ? `<span class="count">${abertas}</span>` : ''],
        ['organograma', 'network', 'Organograma e cota', 'Cota', ''],
    ];
    const carregando = e.cota === null;
    const conteudo = carregando ? renderVazio('loader', 'Carregando o painel...') : {
        candidaturas: renderAbaCandidaturasRecebidas,
        compativeis: renderAbaCompativeis,
        vagas: renderAbaMinhasVagas,
        organograma: renderAbaOrganograma,
    }[e.aba]();

    return `
        <div class="container">
            <div class="dash-header">
                <div>
                    <h2>${esc(state.usuario.nome)}</h2>
                    <p class="muted">Publique vagas, avalie candidatos e acompanhe sua cota de aprendizes.</p>
                </div>
                ${carregando ? '' : renderResumoCota()}
            </div>
            <nav class="tabs">
                ${abas.map(([id, icone, nome, nomeCurto, extra]) => `
                    <button class="tab ${e.aba === id ? 'active' : ''}" onclick="trocarAbaEmpresa('${id}')">
                        <i data-lucide="${icone}"></i> <span class="nome-longo">${nome}</span><span class="nome-curto">${nomeCurto}</span> ${extra}
                    </button>
                `).join('')}
            </nav>
            ${conteudo}
        </div>
    `;
}

function renderResumoCota() {
    const c = state.empresa.cota;
    if (!c.total_funcionarios) {
        return `
            <div class="completude">
                <div class="small"><strong>Cota ainda não calculada</strong></div>
                <button class="link-btn small" onclick="trocarAbaEmpresa('organograma')">Preencher o organograma</button>
            </div>
        `;
    }
    const pct = c.cota_minima ? Math.min(100, Math.round(c.contratados / c.cota_minima * 100)) : 100;
    const cumprida = c.contratados >= c.cota_minima;
    return `
        <div class="completude">
            <div class="row-between small">
                <span>Cota: <strong>${c.contratados} de ${c.cota_minima}</strong> aprendizes</span>
                ${cumprida ? '<span class="badge badge-success"><i data-lucide="check"></i> Cumprida</span>' : `<span class="badge badge-warning">Faltam ${c.faltam_para_cota_minima}</span>`}
            </div>
            <div class="progress" style="margin-top: 6px;"><span style="width: ${Math.max(pct, 2)}%"></span></div>
        </div>
    `;
}

// ---------- Ações comuns sobre candidatos ----------

function renderAcoesCandidato(candidato) {
    return `
        ${candidato.curriculo_url ? `<button class="btn btn-ghost btn-sm" onclick="abrirEmNovaAba('${esc(candidato.curriculo_url)}')"><i data-lucide="file-text"></i> Currículo</button>` : ''}
        ${candidato.video_url ? `<button class="btn btn-ghost btn-sm" onclick="abrirEmNovaAba('${esc(candidato.video_url)}')"><i data-lucide="video"></i> Vídeo</button>` : ''}
        <a class="btn btn-ghost btn-sm" href="mailto:${esc(candidato.email)}"><i data-lucide="mail"></i> E-mail</a>
    `;
}

function renderCompat(valor) {
    return `
        <div class="compat" title="Compatibilidade calculada pelo Filtro Inteligente">
            <div class="progress"><span style="width: ${Math.max(valor, 2)}%"></span></div>
            <strong>${Math.round(valor)}% compatível</strong>
        </div>
    `;
}

// ---------- Aba: candidaturas recebidas ----------

function renderAbaCandidaturasRecebidas() {
    const e = state.empresa;
    if (!e.candidaturas.length) {
        return `
            <div class="card empty-state">
                <i data-lucide="inbox"></i>
                <p>Nenhuma candidatura recebida ainda.</p>
                <p class="small">Veja os jovens que combinam com suas vagas na aba "Candidatos compatíveis".</p>
            </div>
        `;
    }
    const lista = e.filtroVaga === 'todas' ? e.candidaturas : e.candidaturas.filter(c => String(c.vaga_id) === e.filtroVaga);
    const vagasComCandidatura = [...new Map(e.candidaturas.map(c => [c.vaga_id, c.vaga_titulo])).entries()];

    return `
        <div class="row-between" style="margin-bottom: 1rem;">
            <h3 style="margin: 0;">${lista.length} candidatura(s)</h3>
            <label class="row small">Vaga:
                <select class="form-control form-control-sm" onchange="state.empresa.filtroVaga = this.value; render();">
                    <option value="todas">Todas</option>
                    ${vagasComCandidatura.map(([id, titulo]) => `<option value="${id}" ${e.filtroVaga === String(id) ? 'selected' : ''}>${esc(titulo)}</option>`).join('')}
                </select>
            </label>
        </div>
        ${lista.map(c => {
            const [rotulo, classe] = STATUS_EMPRESA[c.status];
            return `
                <article class="card vaga-card">
                    <div class="candidato-topo">
                        <div class="avatar">${iniciais(c.candidato.nome)}</div>
                        <div class="candidato-info">
                            <div class="row-between">
                                <h4>${esc(c.candidato.nome)}</h4>
                                <span class="badge ${classe}">${rotulo}</span>
                            </div>
                            <div class="meta">
                                <span><i data-lucide="briefcase"></i> ${esc(c.vaga_titulo)}</span>
                                ${c.candidato.cidade ? `<span><i data-lucide="map-pin"></i> ${esc(c.candidato.cidade)}</span>` : ''}
                                <span><i data-lucide="calendar"></i> ${formatarData(c.criado_em)}</span>
                            </div>
                        </div>
                    </div>
                    <p class="descricao">${esc(c.candidato.descricao)}</p>
                    <div class="rodape">
                        ${renderCompat(c.compatibilidade)}
                        <div class="row">
                            ${renderAcoesCandidato(c.candidato)}
                            <label class="sr-only" for="status_${c.id}">Status da candidatura</label>
                            <select id="status_${c.id}" class="form-control form-control-sm" onchange="atualizarStatus(${Number(c.id)}, this)">
                                ${Object.entries(STATUS_EMPRESA).map(([valor, [nome]]) => `<option value="${valor}" ${c.status === valor ? 'selected' : ''}>${nome}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </article>
            `;
        }).join('')}
    `;
}

async function atualizarStatus(candidaturaId, select) {
    select.disabled = true;
    try {
        await api(`/candidaturas/${candidaturaId}`, {method: 'PATCH', body: {status: select.value}});
        await recarregarEmpresa('candidaturas', 'cota');
        toast(select.value === 'contratado' ? 'Candidato contratado! A cota foi atualizada.' : 'Status atualizado.');
        render();
    } catch (err) {
        select.disabled = false;
        toast(err.message, true);
    }
}

// ---------- Aba: candidatos compatíveis ----------

function renderAbaCompativeis() {
    const e = state.empresa;
    const abertas = e.vagas.filter(v => v.aberta);
    if (!abertas.length) {
        return `
            <div class="card empty-state">
                <i data-lucide="briefcase"></i>
                <p>Publique uma vaga para o Filtro Inteligente encontrar jovens compatíveis.</p>
                <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="trocarAbaEmpresa('vagas')">Publicar vaga</button>
            </div>
        `;
    }
    return `
        <p class="muted" style="margin-bottom: 1.25rem;">
            O Filtro Inteligente compara o perfil de cada jovem com a descrição das suas vagas abertas.
            Os mais compatíveis aparecem primeiro, mesmo que ainda não tenham se candidatado.
        </p>
        ${abertas.map(vaga => {
            const lista = e.compativeis.filter(c => c.vaga_id === vaga.id);
            return `
                <section style="margin-bottom: 2rem;">
                    <div class="row-between" style="margin-bottom: 0.75rem;">
                        <h3 style="margin: 0;">${esc(vaga.titulo)}</h3>
                        <span class="muted small">${lista.length} jovem(ns) compatível(is)</span>
                    </div>
                    ${lista.length ? lista.map(c => `
                        <article class="card vaga-card">
                            <div class="candidato-topo">
                                <div class="avatar">${iniciais(c.candidato_nome)}</div>
                                <div class="candidato-info">
                                    <div class="row-between">
                                        <h4>${esc(c.candidato_nome)}</h4>
                                        ${c.ja_candidatou ? '<span class="badge badge-success"><i data-lucide="check"></i> Já se candidatou</span>' : ''}
                                    </div>
                                    <div class="meta">
                                        ${c.candidato_cidade ? `<span><i data-lucide="map-pin"></i> ${esc(c.candidato_cidade)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <p class="descricao">${esc(c.candidato_descricao)}</p>
                            <div class="rodape">
                                ${renderCompat(c.compatibilidade)}
                                <div class="row">${renderAcoesCandidato({curriculo_url: c.curriculo_url, video_url: c.video_url, email: c.candidato_email})}</div>
                            </div>
                        </article>
                    `).join('') : '<div class="card muted small">Nenhum jovem compatível com esta vaga ainda.</div>'}
                </section>
            `;
        }).join('')}
    `;
}

// ---------- Aba: minhas vagas ----------

function renderAbaMinhasVagas() {
    const e = state.empresa;
    const lista = e.vagas.length ? e.vagas.map(v => e.editandoVaga === v.id ? renderEdicaoVaga(v) : `
        <article class="card vaga-card">
            <div class="row-between">
                <h4>${esc(v.titulo)}</h4>
                ${v.aberta ? '<span class="badge badge-success">Aberta</span>' : '<span class="badge badge-neutral">Encerrada</span>'}
            </div>
            <div class="meta"><span><i data-lucide="users"></i> ${v.total_candidaturas} candidatura(s)</span></div>
            <p class="descricao">${esc(v.descricao)}</p>
            <div class="rodape">
                <span></span>
                <div class="row">
                    <button class="btn btn-ghost btn-sm" onclick="state.empresa.editandoVaga = ${Number(v.id)}; render();"><i data-lucide="pencil"></i> Editar</button>
                    <button class="btn btn-ghost btn-sm" onclick="alternarVaga(${Number(v.id)}, ${!v.aberta})">
                        <i data-lucide="${v.aberta ? 'lock' : 'unlock'}"></i> ${v.aberta ? 'Encerrar' : 'Reabrir'}
                    </button>
                </div>
            </div>
        </article>
    `).join('') : renderVazio('briefcase', 'Você ainda não publicou vagas.');

    return `
        <div class="grid-2 grid-vagas">
            <div class="glass-panel">
                <h3>Nova vaga</h3>
                <div id="erro_form">${renderErroForm()}</div>
                <form onsubmit="publicarVaga(event)">
                    <div class="form-group">
                        <label for="vac_title">Título da vaga</label>
                        <input type="text" id="vac_title" class="form-control" placeholder="Ex: Assistente Administrativo" minlength="3" required>
                    </div>
                    <div class="form-group">
                        <label for="vac_desc">Descrição e requisitos</label>
                        <textarea id="vac_desc" class="form-control" rows="5" minlength="10" required
                            placeholder="Ex: Auxiliar nas rotinas do escritório, organizar documentos e atender telefone."></textarea>
                        <p class="hint">Descreva as atividades com detalhes: o Filtro Inteligente usa este texto para encontrar candidatos.</p>
                    </div>
                    <button type="submit" class="btn btn-secondary"><i data-lucide="plus"></i> Publicar vaga</button>
                </form>
            </div>
            <div>${lista}</div>
        </div>
    `;
}

function renderEdicaoVaga(v) {
    return `
        <article class="card">
            <form onsubmit="salvarVaga(event, ${Number(v.id)})">
                <div class="form-group">
                    <label for="edit_titulo">Título</label>
                    <input type="text" id="edit_titulo" class="form-control" value="${esc(v.titulo)}" minlength="3" required>
                </div>
                <div class="form-group">
                    <label for="edit_desc">Descrição e requisitos</label>
                    <textarea id="edit_desc" class="form-control" rows="4" minlength="10" required>${esc(v.descricao)}</textarea>
                </div>
                <div class="row">
                    <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="save"></i> Salvar</button>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="state.empresa.editandoVaga = null; render();">Cancelar</button>
                </div>
            </form>
        </article>
    `;
}

async function publicarVaga(e) {
    e.preventDefault();
    const form = e.target;
    travarBotao(form, true, 'Publicando...');
    try {
        await api('/vagas/', {method: 'POST', body: {
            titulo: document.getElementById('vac_title').value.trim(),
            descricao: document.getElementById('vac_desc').value.trim(),
        }});
        await recarregarEmpresa('vagas', 'compativeis');
        state.erroForm = '';
        toast('Vaga publicada! Veja os candidatos compatíveis.');
        render();
    } catch (err) {
        travarBotao(form, false);
        mostrarErroForm(err.message);
    }
}

async function salvarVaga(e, vagaId) {
    e.preventDefault();
    try {
        await api(`/vagas/${vagaId}`, {method: 'PATCH', body: {
            titulo: document.getElementById('edit_titulo').value.trim(),
            descricao: document.getElementById('edit_desc').value.trim(),
        }});
        state.empresa.editandoVaga = null;
        await recarregarEmpresa('vagas', 'compativeis', 'candidaturas');
        toast('Vaga atualizada.');
        render();
    } catch (err) {
        toast(err.message, true);
    }
}

async function alternarVaga(vagaId, aberta) {
    try {
        await api(`/vagas/${vagaId}`, {method: 'PATCH', body: {aberta}});
        await recarregarEmpresa('vagas', 'compativeis');
        toast(aberta ? 'Vaga reaberta.' : 'Vaga encerrada. Ela não aparece mais para os jovens.');
        render();
    } catch (err) {
        toast(err.message, true);
    }
}

// ---------- Aba: organograma e cota ----------

// Mesma regra do backend: mínimo de 5% (fração arredonda para cima) e máximo de 15%.
function calcularCota(base) {
    const minima = Math.floor((base * 5 + 99) / 100);
    return {minima, maxima: Math.max(minima, Math.floor(base * 15 / 100))};
}

function totaisOrganograma() {
    const setores = state.empresa.setores;
    const numero = s => Math.max(0, parseInt(s.funcionarios, 10) || 0);
    const total = setores.reduce((soma, s) => soma + numero(s), 0);
    const base = setores.filter(s => s.exige_formacao).reduce((soma, s) => soma + numero(s), 0);
    return {total, base, ...calcularCota(base)};
}

function renderAbaOrganograma() {
    const e = state.empresa;
    const t = totaisOrganograma();
    return `
        <div class="grid-2">
            <div class="glass-panel">
                <h3>Organograma da empresa</h3>
                <p class="muted small" style="margin-bottom: 1rem;">
                    Informe os setores e quantos funcionários cada um tem. Marque os setores cujas funções
                    <strong>exigem formação profissional</strong>: só eles entram no cálculo da cota.
                </p>
                <form onsubmit="salvarOrganograma(event)">
                    <div class="setor-cabecalho small muted">
                        <span>Setor</span><span>Funcionários</span><span>Exige formação</span><span></span>
                    </div>
                    ${e.setores.map((s, i) => `
                        <div class="setor-row">
                            <input type="text" class="form-control" placeholder="Ex: Produção" value="${esc(s.nome)}"
                                aria-label="Nome do setor ${i + 1}" oninput="editarSetor(${i}, 'nome', this.value)">
                            <input type="number" class="form-control" min="0" placeholder="0" value="${esc(s.funcionarios)}"
                                aria-label="Funcionários do setor ${i + 1}" oninput="editarSetor(${i}, 'funcionarios', this.value)">
                            <label class="setor-check">
                                <input type="checkbox" ${s.exige_formacao ? 'checked' : ''} onchange="editarSetor(${i}, 'exige_formacao', this.checked)">
                                <span class="setor-check-texto">Exige formação</span>
                            </label>
                            <button type="button" class="btn btn-ghost btn-sm btn-icon" onclick="removerSetor(${i})" aria-label="Remover setor ${i + 1}" title="Remover setor">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `).join('')}
                    <div class="row" style="margin-top: 1rem;">
                        <button type="button" class="btn btn-ghost btn-sm" onclick="adicionarSetor()"><i data-lucide="plus"></i> Adicionar setor</button>
                        <button type="submit" class="btn btn-secondary btn-sm"><i data-lucide="save"></i> Salvar organograma</button>
                    </div>
                </form>
            </div>
            <div class="stack">
                <div class="glass-panel">
                    <h3>Cálculo da cota</h3>
                    <div class="stats">
                        <div class="stat"><strong id="org_total">${t.total}</strong><span>Funcionários no total</span></div>
                        <div class="stat"><strong id="org_base">${t.base}</strong><span>Em funções que exigem formação</span></div>
                        <div class="stat destaque"><strong id="org_min">${t.minima}</strong><span>Cota mínima (5%)</span></div>
                        <div class="stat"><strong id="org_max">${t.maxima}</strong><span>Limite máximo (15%)</span></div>
                    </div>
                    <p class="hint" style="margin-top: 1rem;">
                        Art. 429 da CLT: de 5% a 15% dos trabalhadores em funções que exigem formação profissional.
                        Frações arredondam para cima no mínimo (ex.: 42 × 5% = 2,1 → 3 aprendizes).
                        O cálculo é atualizado enquanto você digita; clique em "Salvar organograma" para registrar.
                    </p>
                    <div class="alert alert-info" style="margin: 1rem 0 0;">
                        <i data-lucide="users"></i>
                        <span>Aprendizes contratados pelo Empregae: <strong>${e.cota.contratados}</strong>.
                        ${e.cota.total_funcionarios ? (e.cota.faltam_para_cota_minima ? `Faltam <strong>${e.cota.faltam_para_cota_minima}</strong> para a cota mínima registrada.` : 'A cota mínima registrada está cumprida.') : 'Salve o organograma para registrar a cota.'}</span>
                    </div>
                </div>
                ${renderDadosEmpresa()}
            </div>
        </div>
    `;
}

function editarSetor(indice, campo, valor) {
    state.empresa.setores[indice][campo] = valor;
    const t = totaisOrganograma();
    // Atualiza só os números, sem redesenhar a tela (o campo continua com o cursor).
    [['org_total', t.total], ['org_base', t.base], ['org_min', t.minima], ['org_max', t.maxima]]
        .forEach(([id, v]) => document.getElementById(id).textContent = v);
}

function adicionarSetor() {
    state.empresa.setores.push({nome: '', funcionarios: '', exige_formacao: true});
    render();
}

function removerSetor(indice) {
    state.empresa.setores.splice(indice, 1);
    if (!state.empresa.setores.length) adicionarSetor();
    else render();
}

async function salvarOrganograma(e) {
    e.preventDefault();
    const form = e.target;
    const setores = state.empresa.setores
        .filter(s => s.nome.trim() || s.funcionarios !== '')
        .map(s => ({nome: s.nome.trim(), funcionarios: parseInt(s.funcionarios, 10) || 0, exige_formacao: !!s.exige_formacao}));
    if (setores.some(s => s.nome.length < 2)) return toast('Dê um nome (mínimo 2 letras) para cada setor preenchido.', true);

    travarBotao(form, true, 'Salvando...');
    try {
        await api('/empresas/me/organograma', {method: 'PUT', body: {setores}});
        state.usuario = await api('/empresas/me');
        await recarregarEmpresa('cota');
        toast('Organograma salvo! Cota recalculada.');
        render();
    } catch (err) {
        travarBotao(form, false);
        toast(err.message, true);
    }
}

function renderDadosEmpresa() {
    const u = state.usuario;
    return `
        <div class="glass-panel">
            <h3>Dados da empresa</h3>
            <div id="erro_form">${renderErroForm()}</div>
            <form onsubmit="salvarDadosEmpresa(event)">
                <div class="form-group">
                    <label for="emp_nome">Nome da empresa</label>
                    <input type="text" id="emp_nome" class="form-control" value="${esc(u.nome)}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="emp_cnpj">CNPJ</label>
                        <input type="text" id="emp_cnpj" class="form-control" value="${esc(u.cnpj || '')}" placeholder="00.000.000/0000-00" inputmode="numeric">
                    </div>
                    <div class="form-group">
                        <label>E-mail</label>
                        <input type="email" class="form-control" value="${esc(u.email)}" disabled>
                    </div>
                </div>
                <p class="small muted" style="margin: 0.5rem 0 1rem;"><i data-lucide="eye"></i> Os campos abaixo aparecem no perfil público que os jovens veem.</p>
                <div class="form-row">
                    <div class="form-group">
                        <label for="emp_area">Área de atuação</label>
                        <input type="text" id="emp_area" class="form-control" value="${esc(u.area_atuacao || '')}" placeholder="Ex: Varejo, Indústria, Tecnologia">
                    </div>
                    <div class="form-group">
                        <label for="emp_cidade">Cidade</label>
                        <input type="text" id="emp_cidade" class="form-control" value="${esc(u.cidade || '')}" placeholder="Ex: Recife - PE">
                    </div>
                </div>
                <div class="form-group">
                    <label for="emp_site">Site</label>
                    <input type="text" id="emp_site" class="form-control" value="${esc(u.site || '')}" placeholder="www.suaempresa.com.br" inputmode="url">
                </div>
                <div class="form-group">
                    <label for="emp_desc">Sobre a empresa</label>
                    <textarea id="emp_desc" class="form-control" rows="4" maxlength="2000"
                        placeholder="Conte o que a empresa faz, como é o ambiente de trabalho e o que oferece aos aprendizes.">${esc(u.descricao || '')}</textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="save"></i> Salvar dados</button>
            </form>
        </div>
    `;
}

async function salvarDadosEmpresa(e) {
    e.preventDefault();
    const form = e.target;
    const cnpj = document.getElementById('emp_cnpj').value.trim();
    travarBotao(form, true, 'Salvando...');
    try {
        state.usuario = await api('/empresas/me', {method: 'PATCH', body: {
            nome: document.getElementById('emp_nome').value.trim(),
            ...(cnpj ? {cnpj} : {}),
            area_atuacao: document.getElementById('emp_area').value.trim() || null,
            cidade: document.getElementById('emp_cidade').value.trim() || null,
            site: document.getElementById('emp_site').value.trim() || null,
            descricao: document.getElementById('emp_desc').value.trim() || null,
        }});
        state.erroForm = '';
        toast('Dados da empresa atualizados.');
        render();
    } catch (err) {
        travarBotao(form, false);
        mostrarErroForm(err.message);
    }
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
