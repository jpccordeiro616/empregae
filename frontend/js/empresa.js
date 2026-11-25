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
    if (c.obrigatoria === false) {
        return `
            <div class="completude">
                <div class="row-between small">
                    <span><strong>Cota não obrigatória</strong></span>
                    <span class="badge badge-neutral">Dispensada</span>
                </div>
                <p class="hint">${esc(c.motivo)} Contratar aprendizes continua possível. Aprendizes contratados: ${c.contratados}.</p>
            </div>
        `;
    }
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
    if (!candidato.email) {
        return `<span class="small muted"><i data-lucide="lock"></i> Contato e arquivos liberados quando o jovem se candidatar a uma vaga sua.</span>`;
    }
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
                                ${c.candidato.idade !== null ? `<span><i data-lucide="cake"></i> ${Number(c.candidato.idade)} anos</span>` : ''}
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
    if (state.empresa.cota && state.empresa.cota.obrigatoria === false) return {minima: 0, maxima: '—'};
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
                    ${e.cota.obrigatoria === false ? `<div class="alert alert-info"><i data-lucide="info"></i><span>${esc(e.cota.motivo)} A contratação de aprendizes continua possível.</span></div>` : ''}
                    <div class="stats">
                        <div class="stat"><strong id="org_total">${t.total}</strong><span>Funcionários no total</span></div>
                        <div class="stat"><strong id="org_base">${t.base}</strong><span>Em funções que exigem formação</span></div>
                        <div class="stat destaque"><strong id="org_min">${t.minima}</strong><span>Cota mínima (5%)</span></div>
                        <div class="stat"><strong id="org_max">${t.maxima}</strong><span>Limite máximo (15%)</span></div>
                    </div>
                    <p class="hint" style="margin-top: 1rem;">
                        CLT, art. 429, e Decreto 9.579/2018, art. 51: de 5% a 15% dos trabalhadores em funções que exigem
                        formação profissional. Frações arredondam para cima (ex.: 42 × 5% = 2,1 → 3 aprendizes).
                        ME, EPP e entidades sem fins lucrativos de educação profissional são dispensadas.
                        O cálculo é atualizado enquanto você digita; clique em "Salvar organograma" para registrar.
                    </p>
                    <div class="alert alert-info" style="margin: 1rem 0 0;">
                        <i data-lucide="users"></i>
                        <span>Aprendizes contratados pelo Empregae: <strong>${e.cota.contratados}</strong>.
                        ${e.cota.obrigatoria === false ? '' : e.cota.total_funcionarios ? (e.cota.faltam_para_cota_minima ? `Faltam <strong>${e.cota.faltam_para_cota_minima}</strong> para a cota mínima registrada.` : 'A cota mínima registrada está cumprida.') : 'Salve o organograma para registrar a cota.'}</span>
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
                <div class="form-group">
                    <label for="emp_porte">Porte</label>
                    <select id="emp_porte" class="form-control">${opcoesPorte(u.porte || 'demais')}</select>
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
        ${renderExcluirConta('empresa')}
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
            porte: document.getElementById('emp_porte').value,
        }});
        await recarregarEmpresa('cota');  // o porte muda a obrigatoriedade da cota
        state.erroForm = '';
        toast('Dados da empresa atualizados.');
        render();
    } catch (err) {
        travarBotao(form, false);
        mostrarErroForm(err.message);
    }
}
