// ==========================================================
// Empregae — utilidades
// Funções pequenas usadas por todas as telas.
// ==========================================================

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
