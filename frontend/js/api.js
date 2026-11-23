// ==========================================================
// Empregae — comunicação com o backend (Semana 8)
// Tudo que conversa com a API FastAPI passa por aqui: sessão, fetch e arquivos.
// ==========================================================

const API_URL = '';  // mesma origem: a API também serve o frontend
const SESSAO_KEY = 'empregae_sessao';

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
