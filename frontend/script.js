const state = {
    view: 'landing',
    currentUser: null,
    vacancies: [],
    candidates: []
};

const API_URL = 'http://localhost:8000';

function render() {
    const app = document.getElementById('app');
    let content = `
        <nav class="navbar">
            <div class="logo">
                <i data-lucide="briefcase"></i> Empregae
            </div>
            <div>
                ${state.currentUser ? `
                    <span style="margin-right: 1rem;">Olá, ${state.currentUser.name}</span>
                    <button class="btn btn-secondary" onclick="logout()">Sair</button>
                ` : `
                    <button class="btn btn-primary" onclick="navigate('landing')">Início</button>
                `}
            </div>
        </nav>
        <div class="container">
    `;

    switch(state.view) {
        case 'landing': content += renderLanding(); break;
        case 'register-apprentice': content += renderRegisterApprentice(); break;
        case 'register-company': content += renderRegisterCompany(); break;
        case 'dashboard-company': content += renderCompanyDashboard(); break;
        case 'dashboard-apprentice': content += renderApprenticeDashboard(); break;
    }
    
    content += `</div>`;
    app.innerHTML = content;
    if (window.lucide) {
        lucide.createIcons();
    }
}

function navigate(view) {
    state.view = view;
    render();
}

function logout() {
    state.currentUser = null;
    navigate('landing');
}

function renderLanding() {
    return `
        <div style="text-align: center; margin-top: 4rem;">
            <h1 style="font-size: 3rem; margin-bottom: 1rem;">Conectando o Futuro</h1>
            <p style="color: var(--text-muted); font-size: 1.2rem; max-width: 600px; margin: 0 auto 3rem auto;">
                A plataforma inteligente que une jovens aprendizes às empresas, facilitando o cumprimento das cotas e impulsionando carreiras.
            </p>
            <div class="grid-2" style="max-width: 800px; margin: 0 auto;">
                <div class="glass-panel">
                    <h3>Sou Jovem Aprendiz</h3>
                    <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Encontre a oportunidade ideal para iniciar sua carreira com nosso filtro inteligente.</p>
                    <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="navigate('register-apprentice')">
                        Criar meu Perfil
                    </button>
                </div>
                <div class="glass-panel">
                    <h3>Sou Empresa</h3>
                    <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Cumpra a Lei da Aprendizagem encontrando os talentos que dão match com suas vagas.</p>
                    <button class="btn btn-secondary" style="width: 100%; justify-content: center;" onclick="navigate('register-company')">
                        Cadastrar Empresa
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderRegisterApprentice() {
    return `
        <div class="glass-panel" style="max-width: 600px; margin: 2rem auto;">
            <h2>Cadastro de Jovem Aprendiz</h2>
            <form onsubmit="handleRegisterApprentice(event)">
                <div class="form-group">
                    <label>Nome Completo</label>
                    <input type="text" id="app_name" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>E-mail</label>
                    <input type="email" id="app_email" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Senha</label>
                    <input type="password" id="app_password" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Breve Descrição (Habilidades, interesses, o que busca)</label>
                    <textarea id="app_desc" class="form-control" rows="4" required></textarea>
                </div>
                <div class="form-group">
                    <label>Pitch em Vídeo (Protótipo visual)</label>
                    <div style="padding: 20px; border: 1px dashed var(--border); border-radius: 8px; text-align: center; color: var(--text-muted);">
                        <i data-lucide="video" style="margin-bottom: 10px;"></i><br>
                        Gravar vídeo de apresentação
                    </div>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="lgpd" required>
                    <label for="lgpd">Declaro estar ciente e de acordo com as normas da LGPD quanto ao tratamento dos meus dados pessoais sensíveis.</label>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="lei" required>
                    <label for="lei">Estou ciente das regras da Lei da Aprendizagem (Lei nº 10.097/2000).</label>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">Finalizar Cadastro</button>
            </form>
        </div>
    `;
}

function renderRegisterCompany() {
    return `
        <div class="glass-panel" style="max-width: 600px; margin: 2rem auto;">
            <h2>Cadastro de Empresa</h2>
            <form onsubmit="handleRegisterCompany(event)">
                <div class="form-group">
                    <label>Nome da Empresa</label>
                    <input type="text" id="comp_name" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>E-mail Corporativo</label>
                    <input type="email" id="comp_email" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Senha</label>
                    <input type="password" id="comp_password" class="form-control" required>
                </div>
                
                <button type="submit" class="btn btn-secondary" style="width: 100%; justify-content: center;">Cadastrar Empresa</button>
            </form>
        </div>
    `;
}

function renderCompanyDashboard() {
    return `
        <div>
            <h2>Dashboard da Empresa</h2>
            <div class="grid-2">
                <div>
                    <div class="glass-panel" style="margin-bottom: 1rem;">
                        <h3>Nova Vaga</h3>
                        <form onsubmit="handleCreateVacancy(event)">
                            <div class="form-group">
                                <label>Título da Vaga</label>
                                <input type="text" id="vac_title" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label>Descrição e Requisitos</label>
                                <textarea id="vac_desc" class="form-control" rows="3" required></textarea>
                            </div>
                            <button type="submit" class="btn btn-secondary">Publicar Vaga</button>
                        </form>
                    </div>
                    
                    <div class="glass-panel">
                        <h3>Organograma / Cotas</h3>
                        <form onsubmit="handleOrgChart(event)">
                            <div class="form-group" style="margin-top: 10px;">
                                <label>Total de Funcionários (Para cálculo da cota mínima de 5%)</label>
                                <input type="number" id="total_employees" class="form-control" placeholder="Ex: 50" oninput="calculateQuota()">
                            </div>
                            <div class="form-group">
                                <label>Anexar Organograma da Empresa</label>
                                <input type="file" id="org_chart_file" class="form-control" accept="image/*,.pdf">
                            </div>
                            <button type="submit" class="btn btn-secondary">Salvar Organograma</button>
                        </form>
                        <div style="display: flex; gap: 10px; margin-top: 15px;" id="quota_display">
                            <div class="card" style="flex: 1; text-align: center;">
                                <h2 id="quota_value">0</h2>
                                <p style="font-size: 0.8rem; color: var(--text-muted);">Vagas Necessárias (Cota)</p>
                            </div>
                            <div class="card" style="flex: 1; text-align: center; border-color: var(--secondary);">
                                <h2 style="color: var(--secondary);">0</h2>
                                <p style="font-size: 0.8rem; color: var(--text-muted);">Vagas Preenchidas</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="glass-panel">
                    <h3>Candidatos Recomendados (Filtro Inteligente)</h3>
                    <div id="candidates_list">
                        <p style="color: var(--text-muted);">Carregando candidatos que dão match com suas vagas...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderApprenticeDashboard() {
    return `
        <div>
            <h2>Meu Painel</h2>
            <div class="grid-2">
                <div class="glass-panel">
                    <h3>Meu Perfil</h3>
                    <p><strong>Nome:</strong> ${state.currentUser.name}</p>
                    <p><strong>E-mail:</strong> ${state.currentUser.email}</p>
                    <p style="margin-top: 1rem;"><strong>Minha Descrição:</strong><br>
                    <span style="color: var(--text-muted);">${state.currentUser.description}</span></p>
                    
                    <div class="chat-box" style="margin-top: 2rem;">
                        <div style="text-align: center; color: var(--text-muted);">
                            <i data-lucide="message-square"></i>
                            <p>Caixa de Entrada / Propostas</p>
                        </div>
                    </div>
                </div>
                
                <div class="glass-panel" style="margin-bottom: 1rem;">
                    <h3>Buscar Vagas</h3>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <input type="text" id="search_vacancies" class="form-control" placeholder="Buscar por cargo ou empresa...">
                        <button class="btn btn-primary" onclick="searchManualVacancies()"><i data-lucide="search"></i> Buscar</button>
                    </div>
                    <div id="search_results">
                        <!-- Resultados da busca manual aparecerão aqui -->
                    </div>
                </div>
                
                <div class="glass-panel">
                    <h3>Vagas Recomendadas (Filtro Inteligente)</h3>
                    <div id="recommended_vacancies">
                        <p style="color: var(--text-muted);">Analisando seu perfil para encontrar as melhores vagas...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function handleRegisterApprentice(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('app_name').value,
        email: document.getElementById('app_email').value,
        password: document.getElementById('app_password').value,
        description: document.getElementById('app_desc').value,
        accepted_lgpd: document.getElementById('lgpd').checked,
        accepted_aprendizagem: document.getElementById('lei').checked
    };
    
    try {
        const res = await fetch(API_URL + '/apprentices/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        if(res.ok) {
            const result = await res.json();
            state.currentUser = { id: result.id, type: 'apprentice', ...data };
            navigate('dashboard-apprentice');
            setTimeout(fetchApprenticeMatches, 500);
        } else {
            const err = await res.json();
            alert('Erro: ' + (err.detail || 'Falha no cadastro'));
        }
    } catch(err) {
        // Fallback mockup
        state.currentUser = { id: 1, type: 'apprentice', ...data };
        navigate('dashboard-apprentice');
        setTimeout(mockApprenticeMatches, 500);
    }
}

async function handleRegisterCompany(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('comp_name').value,
        email: document.getElementById('comp_email').value,
        password: document.getElementById('comp_password').value
    };
    
    try {
        const res = await fetch(API_URL + '/companies/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        if(res.ok) {
            const result = await res.json();
            state.currentUser = { id: result.id, type: 'company', ...data };
            navigate('dashboard-company');
            setTimeout(fetchCompanyCandidates, 500);
        } else {
            alert('Erro no cadastro');
        }
    } catch(err) {
        state.currentUser = { id: 1, type: 'company', ...data };
        navigate('dashboard-company');
        setTimeout(fetchCompanyCandidates, 500);
    }
}

async function handleCreateVacancy(e) {
    e.preventDefault();
    const data = {
        title: document.getElementById('vac_title').value,
        description: document.getElementById('vac_desc').value,
        company_id: state.currentUser.id
    };
    
    try {
        await fetch(API_URL + '/vacancies/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        document.getElementById('vac_title').value = '';
        document.getElementById('vac_desc').value = '';
        alert('Vaga publicada com sucesso!');
        fetchCompanyCandidates();
    } catch(err) {
        alert('Vaga cadastrada (mock)');
        document.getElementById('vac_title').value = '';
        document.getElementById('vac_desc').value = '';
    }
}

async function fetchApprenticeMatches() {
    try {
        const res = await fetch(API_URL + '/vacancies/match/' + state.currentUser.id);
        if(res.ok) {
            const matches = await res.json();
            renderMatches(matches, 'recommended_vacancies', true);
        }
    } catch(err) {
        mockApprenticeMatches();
    }
}

function mockApprenticeMatches() {
    const list = document.getElementById('recommended_vacancies');
    if(!list) return;
    list.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4>Assistente Administrativo</h4>
                <span class="badge">95% Match</span>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin: 5px 0;">Empresa: TechCorp</p>
            <p style="font-size:0.9rem;">Buscamos jovem para auxiliar nas rotinas administrativas diárias e organização de documentos.</p>
            <button class="btn btn-primary" style="margin-top: 10px; padding: 6px 12px; font-size:0.8rem;" onclick="alert('Candidatura enviada!')">Candidatar-se</button>
        </div>
    `;
}

async function fetchCompanyCandidates() {
    try {
        const res = await fetch(API_URL + '/companies/' + state.currentUser.id + '/candidates');
        if(res.ok) {
            const candidates = await res.json();
            renderMatches(candidates, 'candidates_list', false);
        }
    } catch(err) {
        const list = document.getElementById('candidates_list');
        if(list) list.innerHTML = `<p style="color:var(--text-muted)">Nenhum candidato encontrado (Modo offline).</p>`;
    }
}

function renderMatches(data, elementId, isApprentice) {
    const container = document.getElementById(elementId);
    if(!container) return;
    
    if(data.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted)">Nenhum resultado encontrado.</p>`;
        return;
    }
    
    let html = '';
    data.forEach(item => {
        html += `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4>${isApprentice ? item.title : item.candidate_name}</h4>
                    <span class="badge">${item.match_score}% Match</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-muted); margin: 5px 0;">
                    ${isApprentice ? 'Empresa: ' + item.company_name : 'Para a vaga: ' + item.vacancy_title}
                </p>
                <p style="font-size:0.9rem;">${isApprentice ? item.description : item.candidate_description}</p>
                <button class="btn ${isApprentice ? 'btn-primary' : 'btn-secondary'}" style="margin-top: 10px; padding: 6px 12px; font-size:0.8rem;">
                    ${isApprentice ? 'Candidatar-se' : 'Iniciar Chat'}
                </button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Novas Ações
function calculateQuota() {
    const total = document.getElementById('total_employees').value;
    const quotaValue = document.getElementById('quota_value');
    if(total && total > 0) {
        // Cota de 5% a 15%. Para simulação, usaremos 5% arredondado para cima
        const quota = Math.ceil(total * 0.05);
        quotaValue.innerText = quota;
    } else {
        quotaValue.innerText = '0';
    }
}

function handleOrgChart(e) {
    e.preventDefault();
    alert('Organograma e cotas salvos com sucesso!');
}

function searchManualVacancies() {
    const query = document.getElementById('search_vacancies').value.toLowerCase();
    const resultsContainer = document.getElementById('search_results');
    
    if(!query) {
        resultsContainer.innerHTML = '';
        return;
    }
    
    // Mocking manual search results
    resultsContainer.innerHTML = `
        <div class="card" style="border-color: var(--primary); margin-bottom: 0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4>${query.charAt(0).toUpperCase() + query.slice(1)}</h4>
                <span class="badge" style="background: rgba(79, 70, 229, 0.2); color: var(--primary);">Busca Manual</span>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin: 5px 0;">Empresa: StartUp XYZ</p>
            <p style="font-size:0.9rem;">Vaga encontrada através da busca manual no sistema.</p>
            <button class="btn btn-primary" style="margin-top: 10px; padding: 6px 12px; font-size:0.8rem;" onclick="alert('Candidatura enviada!')">Candidatar-se</button>
        </div>
    `;
    if (window.lucide) {
        lucide.createIcons();
    }
}

window.onload = render;
