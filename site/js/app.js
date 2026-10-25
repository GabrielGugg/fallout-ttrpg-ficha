// ============================================================
// App principal: router por hash e Service Worker
// ============================================================
import { renderHome } from './pages/home.js';
import { renderCreator } from './creator/wizard.js';
import { renderSheet } from './sheet/ficha.js';
import { renderConfig, renderChangelog } from './pages/config.js';
import { lerConfig, aplicarTema } from './config.js';
import { fecharModal, fecharModalTodos } from './utils.js';
import { VERSAO_ATUAL } from './versao.js';

/** Página do hash -> função que a desenha (lista fixa, sem busca por nome). */
function resolverRota(pagina) {
  switch (pagina) {
    case 'home': return renderHome;
    case 'criar': return renderCreator;
    case 'ficha': return renderSheet;
    case 'config': return renderConfig;
    case 'changelog': return renderChangelog;
    default: return null;
  }
}

/** Navega para uma rota do hash. */
export function navegar(rota) {
  window.location.hash = rota;
}
window.navegar = navegar;

/** Define o título do cabeçalho, com o selo da versão e um subtítulo opcional. */
export function definirTitulo(texto, subtitulo = '') {
  const el = document.getElementById('header-titulo');
  el.textContent = '';
  const nome = document.createElement('span');
  nome.className = 'header-nome';
  nome.textContent = texto;
  const v = document.createElement('span');
  v.className = 'header-versao';
  v.textContent = ` v${VERSAO_ATUAL}`;
  nome.appendChild(v);
  el.appendChild(nome);
  if (subtitulo) {
    const sub = document.createElement('span');
    sub.className = 'header-sub';
    sub.textContent = subtitulo;
    el.appendChild(sub);
  }
}

/** Desenha a rota atual. */
function processarRota() {
  const [pagina, ...resto] = (window.location.hash.slice(1) || 'home').split('/');
  fecharModalTodos(); // um modal aberto não sobrevive à troca de tela
  const content = document.getElementById('app-content');
  const voltar = document.getElementById('btn-voltar');
  document.getElementById('header-acoes').innerHTML = '';
  voltar.style.display = pagina === 'home' ? 'none' : 'block';
  voltar.onclick = () => navegar(pagina === 'changelog' ? 'config' : 'home');
  definirTitulo({ home: 'Ficha Fallout 2.1', criar: 'Novo Personagem', ficha: 'Ficha', config: 'Configurações', changelog: 'Changelog' }[pagina] || 'Ficha Fallout 2.1');
  if (pagina === 'home') {
    document.getElementById('header-acoes').innerHTML = `<button type="button" class="header-btn" id="btn-config" title="Configurações" aria-label="Configurações">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>
    </button>`;
    document.getElementById('btn-config').onclick = () => navegar('config');
  }
  window.scrollTo(0, 0);
  const render = resolverRota(pagina);
  if (render) render(content, resto.join('/'));
  else content.innerHTML = '<div class="empty-state"><h2>Página não encontrada</h2><button class="btn btn-primary" onclick="navegar(\'home\')">Voltar ao início</button></div>';
}

/** Inicializa o app. */
function init() {
  aplicarTema(lerConfig().tema);
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
