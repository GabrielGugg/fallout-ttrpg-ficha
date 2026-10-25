// ============================================================
// App principal: router por hash e Service Worker
// ============================================================
import { renderHome } from './pages/home.js';
import { renderCreator } from './creator/wizard.js';
import { renderSheet } from './sheet/ficha.js';
import { fecharModal, fecharModalTodos } from './utils.js';
import { VERSAO_ATUAL } from './versao.js';

/** Página do hash -> função que a desenha (lista fixa, sem busca por nome). */
function resolverRota(pagina) {
  switch (pagina) {
    case 'home': return renderHome;
    case 'criar': return renderCreator;
    case 'ficha': return renderSheet;
    default: return null;
  }
}

/** Navega para uma rota do hash. */
export function navegar(rota) {
  window.location.hash = rota;
}
window.navegar = navegar;

/** Define o título do cabeçalho, com o selo da versão. */
export function definirTitulo(texto) {
  const el = document.getElementById('header-titulo');
  el.textContent = texto;
  const v = document.createElement('span');
  v.className = 'header-versao';
  v.textContent = ` v${VERSAO_ATUAL}`;
  el.appendChild(v);
}

/** Desenha a rota atual. */
function processarRota() {
  const [pagina, ...resto] = (window.location.hash.slice(1) || 'home').split('/');
  fecharModalTodos(); // um modal aberto não sobrevive à troca de tela
  const content = document.getElementById('app-content');
  const voltar = document.getElementById('btn-voltar');
  document.getElementById('header-acoes').innerHTML = '';
  voltar.style.display = pagina === 'home' ? 'none' : 'block';
  voltar.onclick = () => navegar('home');
  definirTitulo({ home: 'Ficha Fallout 2.1', criar: 'Novo Personagem', ficha: 'Ficha' }[pagina] || 'Ficha Fallout 2.1');
  window.scrollTo(0, 0);
  const render = resolverRota(pagina);
  if (render) render(content, resto.join('/'));
  else content.innerHTML = '<div class="empty-state"><h2>Página não encontrada</h2><button class="btn btn-primary" onclick="navegar(\'home\')">Voltar ao início</button></div>';
}

/** Inicializa o app. */
function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW:', err));
    let recarregando = false;
    const tinhaControle = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!tinhaControle || recarregando) return;
      recarregando = true;
      window.location.reload();
    });
  }
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') fecharModal();
  });
  window.addEventListener('hashchange', processarRota);
  processarRota();
}

document.addEventListener('DOMContentLoaded', init);
