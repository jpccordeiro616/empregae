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
