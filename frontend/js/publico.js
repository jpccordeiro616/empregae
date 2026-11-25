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
                <h2>Vagas abertas agora</h2>
                <p>Oportunidades reais publicadas no Empregae. Crie seu perfil para ver quais combinam mais com você.</p>
            </div>
            <div id="vagas_publicas">${renderVagasPublicas()}</div>
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

// ---------- Vagas abertas na página inicial (sem login) ----------

const VAGAS_NA_LANDING = 6;

async function carregarVagasPublicas() {
    state.vagasPublicas = 'carregando';
    try {
        state.vagasPublicas = await api('/vagas/');
    } catch (err) {
        state.vagasPublicas = [];
    }
    // Atualiza só a seção de vagas, sem redesenhar a página inteira.
    const secao = document.getElementById('vagas_publicas');
    if (secao) {
        secao.innerHTML = renderVagasPublicas();
        if (window.lucide) lucide.createIcons();
    }
}

function renderVagasPublicas() {
    const vagas = state.vagasPublicas;
    if (!Array.isArray(vagas)) return '<p class="muted" style="text-align: center;">Carregando vagas...</p>';
    if (!vagas.length) return renderVazio('briefcase', 'Nenhuma vaga aberta no momento. Empresas: publiquem a primeira!');

    const restantes = vagas.length - VAGAS_NA_LANDING;
    return `
        <div class="grid-vagas-publicas">
            ${vagas.slice(0, VAGAS_NA_LANDING).map(v => `
                <article class="card vaga-card vaga-publica">
                    <h4>${esc(v.titulo)}</h4>
                    <div class="meta"><span><i data-lucide="building-2"></i> ${esc(v.empresa_nome)}</span></div>
                    <p class="descricao">${esc(v.descricao)}</p>
                    <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="navigate('cadastro-jovem')">
                        <i data-lucide="send"></i> Quero me candidatar
                    </button>
                </article>
            `).join('')}
        </div>
        <p class="muted" style="text-align: center; margin-top: 1.25rem;">
            ${restantes > 0 ? `E mais <strong>${restantes}</strong> vaga(s). ` : ''}
            <button class="link-btn" onclick="navigate('cadastro-jovem')">Crie seu perfil</button> para ver todas e receber recomendações.
        </p>
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
        if (mensagem) el.scrollIntoView({block: 'center', behavior: 'smooth'});
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
                            <label for="app_nascimento">Data de nascimento</label>
                            <input type="date" id="app_nascimento" class="form-control" required max="${hojeISO()}" oninput="atualizarRegrasIdade()">
                            <p class="hint" id="idade_info">Aprendizes têm de 14 a 24 anos.</p>
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
                    <div class="checkbox-group">
                        <input type="checkbox" id="app_pcd" onchange="atualizarRegrasIdade()">
                        <label for="app_pcd">Sou pessoa com deficiência (sem limite de idade máxima). Essa informação não é mostrada às empresas.</label>
                    </div>
                    <fieldset id="bloco_responsavel" class="bloco-responsavel" hidden>
                        <legend><i data-lucide="shield-check"></i> Responsável legal</legend>
                        <p class="small muted" style="margin-bottom: 0.9rem;">
                            Como você tem menos de 18 anos, sua conta fica vinculada a um responsável legal
                            (ECA Digital, Lei nº 15.211/2025, art. 24).
                        </p>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="resp_nome">Nome do responsável</label>
                                <input type="text" id="resp_nome" class="form-control" minlength="3">
                            </div>
                            <div class="form-group">
                                <label for="resp_email">E-mail do responsável</label>
                                <input type="email" id="resp_email" class="form-control">
                            </div>
                        </div>
                        <div class="checkbox-group" style="margin-bottom: 0;">
                            <input type="checkbox" id="resp_aceite">
                            <label for="resp_aceite">Meu responsável legal está ciente e autoriza meu cadastro no Empregae.</label>
                        </div>
                    </fieldset>
                    <div class="alert alert-info"><i data-lucide="info"></i><span>Depois do cadastro, você poderá enviar seu currículo e um vídeo de apresentação.</span></div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="lgpd" required>
                        <label for="lgpd">Li a <a href="/#privacidade" target="_blank">política de privacidade</a> e concordo com o tratamento dos meus dados conforme a LGPD (Lei nº 13.709/2018).</label>
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
            data_nascimento: document.getElementById('app_nascimento').value,
            pcd: document.getElementById('app_pcd').checked,
            responsavel_nome: document.getElementById('resp_nome').value.trim() || null,
            responsavel_email: document.getElementById('resp_email').value.trim() || null,
            aceite_responsavel: document.getElementById('resp_aceite').checked,
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

// ---------- Regras de idade no cadastro (Semana 10) ----------

function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function idadeEm(nascimentoISO) {
    const [a, m, d] = nascimentoISO.split('-').map(Number);
    const hoje = new Date();
    return hoje.getFullYear() - a - ((hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) ? 1 : 0);
}

// Mostra o bloco do responsável para menores de 18 e avisa sobre a faixa de 14 a 24 anos.
// A API confere as mesmas regras; aqui é só para orientar quem está preenchendo.
function atualizarRegrasIdade() {
    const valor = document.getElementById('app_nascimento').value;
    const info = document.getElementById('idade_info');
    const bloco = document.getElementById('bloco_responsavel');
    const pcd = document.getElementById('app_pcd').checked;
    mostrarErroForm('');  // um erro de idade anterior deixa de valer quando a data muda
    if (!valor) return;
    const idade = idadeEm(valor);
    const menor = idade >= 14 && idade < 18;
    bloco.hidden = !menor;
    ['resp_nome', 'resp_email', 'resp_aceite'].forEach(id => document.getElementById(id).required = menor);
    if (idade < 14) info.textContent = `${idade} anos: a Lei da Aprendizagem permite aprendizes a partir de 14 anos.`;
    else if (idade > 24 && !pcd) info.textContent = `${idade} anos: o limite é 24 anos (sem limite para pessoa com deficiência).`;
    else info.textContent = `${idade} anos.`;
    info.classList.toggle('hint-erro', idade < 14 || (idade > 24 && !pcd));
}

const PORTES = [
    ['demais', 'Demais empresas (médio e grande porte)'],
    ['me', 'Microempresa (ME)'],
    ['epp', 'Empresa de pequeno porte (EPP)'],
    ['esfl', 'Entidade sem fins lucrativos de educação profissional'],
];

function opcoesPorte(selecionado) {
    return PORTES.map(([valor, nome]) => `<option value="${valor}" ${valor === selecionado ? 'selected' : ''}>${nome}</option>`).join('');
}

// ---------- Política de privacidade (LGPD / ECA Digital) ----------

function renderPrivacidade() {
    return `
        <div class="container-narrow politica">
            <div class="glass-panel">
                <h2>Política de privacidade</h2>
                <p class="muted small">Empregae · projeto acadêmico · última atualização: novembro de 2026</p>

                <h3>1. Quais dados coletamos</h3>
                <ul>
                    <li><strong>Jovens:</strong> nome, e-mail, senha (guardada só como código criptografado), data de nascimento, cidade, descrição, currículo, vídeo de apresentação e, se informado, se é pessoa com deficiência. Para menores de 18 anos: nome e e-mail do responsável legal.</li>
                    <li><strong>Empresas:</strong> nome, e-mail, senha (criptografada), CNPJ, porte, organograma (setores e funcionários) e dados de apresentação.</li>
                </ul>

                <h3>2. Para que usamos</h3>
                <ul>
                    <li>Conectar jovens a vagas de aprendizagem e calcular a compatibilidade (Filtro Inteligente).</li>
                    <li>A data de nascimento serve só para conferir as regras de idade da Lei da Aprendizagem e da proteção de menores.</li>
                    <li>Calcular a cota de aprendizes das empresas.</li>
                    <li>Não há publicidade e os dados não são vendidos nem usados para outra finalidade.</li>
                </ul>

                <h3>3. Quem vê os seus dados</h3>
                <ul>
                    <li>Antes de você se candidatar, uma empresa vê apenas o seu <strong>primeiro nome</strong> e a sua <strong>descrição</strong>.</li>
                    <li>Depois que você se candidata a uma vaga dela, a empresa passa a ver nome completo, e-mail, cidade, idade, currículo e vídeo.</li>
                    <li>Empresas <strong>nunca</strong> veem sua data de nascimento, a informação sobre deficiência nem os dados do seu responsável.</li>
                    <li>O perfil público das empresas não mostra e-mail, CNPJ, organograma nem cota.</li>
                </ul>

                <h3>4. Menores de idade</h3>
                <p>O tratamento de dados de adolescentes é feito no seu melhor interesse (LGPD, art. 14). Contas de menores de 18 anos ficam vinculadas a um responsável legal, que informa nome e e-mail e autoriza o cadastro (ECA Digital, Lei nº 15.211/2025, art. 24). A plataforma usa por padrão a configuração mais protetiva (art. 7º): o contato só é liberado para empresas às quais o jovem se candidatou.</p>

                <h3>5. Seus direitos (LGPD, art. 18)</h3>
                <ul>
                    <li><strong>Acesso e correção:</strong> veja e edite seus dados em "Meu perfil".</li>
                    <li><strong>Eliminação:</strong> use "Excluir minha conta" no perfil. A conta, as candidaturas, o currículo e o vídeo são apagados.</li>
                </ul>

                <h3>6. Segurança</h3>
                <p>Senhas criptografadas (bcrypt), acesso por login com token, banco de dados com acesso restrito e arquivos visíveis só para o dono e para as empresas às quais ele se candidatou.</p>

                <p class="muted small" style="margin-top: 1.5rem;">Este é um projeto acadêmico em fase de testes. Os dados podem ser apagados ao final dos testes.</p>
                <button class="btn btn-ghost btn-sm" style="margin-top: 1rem;" onclick="irParaInicio()"><i data-lucide="arrow-left"></i> Voltar</button>
            </div>
        </div>
    `;
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
                        <label for="comp_porte">Porte</label>
                        <select id="comp_porte" class="form-control">${opcoesPorte('demais')}</select>
                        <p class="hint">ME, EPP e entidades sem fins lucrativos de educação profissional são dispensadas da cota.</p>
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
            porte: document.getElementById('comp_porte').value,
        }});
        await entrar(res.token, 'empresa');
        toast('Empresa cadastrada com sucesso!');
    } catch (err) {
        travarBotao(form, false);
        mostrarErroForm(err.message);
    }
}
