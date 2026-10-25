// ============================================================
// Utilitários de interface compartilhados (modal, toast, HTML)
// ============================================================

/** Escapa texto do usuário antes de interpolar em HTML. */
export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Gera um id curto e único o bastante para personagens e itens. */
export function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Converte o Markdown simples das regras (negrito, itálico, listas, parágrafos) em HTML seguro. */
export function mdParaHtml(texto) {
  const inline = s => escHtml(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  return String(texto || '').split(/\n{2,}/).map(bloco => {
    const linhas = bloco.split('\n');
    if (linhas.every(l => /^\s*[-*] /.test(l))) {
      return '<ul>' + linhas.map(l => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('') + '</ul>';
    }
    if (linhas.every(l => /^\s*\d+\. /.test(l))) {
      return '<ol>' + linhas.map(l => `<li>${inline(l.replace(/^\s*\d+\. /, ''))}</li>`).join('') + '</ol>';
    }
    return `<p>${linhas.map(inline).join('<br>')}</p>`;
  }).join('');
}

/** Mostra uma mensagem curta no rodapé. tipo: '', 'sucesso' ou 'erro'. */
export function toast(msg, tipo = '') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Pilha de modais: abrir um modal sobre outro guarda os nós do anterior
// (com os eventos ligados) e os devolve ao fechar.
const pilhaModais = [];
let aoFecharAtual = null;
const IDS_MODAL = ['modal-titulo', 'modal-corpo', 'modal-acoes'];

/** Tira os filhos de um elemento para um fragmento (preserva os eventos). */
function retirarFilhos(el) {
  const frag = document.createDocumentFragment();
  while (el.firstChild) frag.appendChild(el.firstChild);
  return frag;
}

/** Abre o modal global com título, corpo e botões (HTML). onClose roda ao fechar. */
export function abrirModal(titulo, corpoHtml, acoesHtml = '', onClose = null) {
  const overlay = document.getElementById('modal-overlay');
  if (overlay.style.display === 'flex') {
    pilhaModais.push({
      partes: IDS_MODAL.map(id => retirarFilhos(document.getElementById(id))),
      onClose: aoFecharAtual,
      scroll: document.getElementById('modal-corpo').scrollTop,
    });
  }
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-corpo').innerHTML = corpoHtml;
  document.getElementById('modal-corpo').scrollTop = 0;
  document.getElementById('modal-acoes').innerHTML = acoesHtml;
  aoFecharAtual = onClose;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  return document.getElementById('modal-corpo');
}

/** Fecha o modal do topo da pilha (e reabre o anterior, se houver). */
export function fecharModal() {
  const cb = aoFecharAtual;
  aoFecharAtual = null;
  const anterior = pilhaModais.pop();
  if (anterior) {
    IDS_MODAL.forEach((id, i) => {
      const el = document.getElementById(id);
      el.innerHTML = '';
      el.appendChild(anterior.partes[i]);
    });
    document.getElementById('modal-corpo').scrollTop = anterior.scroll;
    aoFecharAtual = anterior.onClose;
  } else {
    document.getElementById('modal-overlay').style.display = 'none';
    document.body.style.overflow = '';
  }
  if (cb) cb();
}

/** Fecha todos os modais abertos. */
export function fecharModalTodos() {
  while (document.getElementById('modal-overlay').style.display === 'flex') fecharModal();
}
window.fecharModal = fecharModal;

/** Baixa um Blob como arquivo. */
export function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Data ISO em formato curto brasileiro. */
export function fmtData(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return ''; }
}

/** Remove acentos e baixa a caixa, para busca. */
export function semAcento(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
