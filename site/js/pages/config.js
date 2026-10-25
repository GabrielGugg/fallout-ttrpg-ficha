// ============================================================
// Tela de Configurações: tema, versão e changelog
// ============================================================
import { escHtml, mdParaHtml } from '../utils.js';
import { TEMAS, lerConfig, salvarConfig, aplicarTema } from '../config.js';
import { VERSAO_ATUAL } from '../versao.js';

/** Desenha a tela de configurações. */
export function renderConfig(container) {
  const desenhar = () => {
    const { tema } = lerConfig();
    container.innerHTML = `
      <div class="card">
        <div class="card-header">Tema</div>
        <div class="config-temas">${TEMAS.map(t => `
          <button type="button" class="tema-card${t.id === tema ? ' ativo' : ''}" data-tema="${t.id}" aria-pressed="${t.id === tema}">
            <span class="tema-amostra">${t.amostra.map(c => `<span style="background:${c}"></span>`).join('')}</span>
            <strong>${escHtml(t.nome)}</strong>
            <small>${escHtml(t.descricao)}</small>
          </button>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header">Sobre</div>
        <div class="config-linha">
          <span>Versão <strong>${VERSAO_ATUAL}</strong></span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="navegar('changelog')">Ver o changelog</button>
        </div>
      </div>`;
    container.querySelectorAll('[data-tema]').forEach(b => {
      b.onclick = () => { aplicarTema(salvarConfig({ tema: b.dataset.tema }).tema); desenhar(); };
    });
  };
  desenhar();
}

/**
 * Changelog: CHANGELOG.md publicado ao lado do app (./CHANGELOG.md) ou na
 * raiz do repositório (../CHANGELOG.md), conforme o servidor.
 */
export async function renderChangelog(container) {
  container.innerHTML = '<div class="carregando">Carregando changelog...</div>';
  let texto = null;
  for (const url of ['./CHANGELOG.md', '../CHANGELOG.md']) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (r.ok) { texto = await r.text(); break; }
    } catch { /* tenta o próximo endereço */ }
  }
  container.innerHTML = texto
    ? `<div class="card md-content changelog">${mdParaHtml(texto.replace(/^# .*\n+/, ''))}</div>`
    : '<div class="empty-state"><h2>Não deu para carregar o changelog.</h2><p>Confira a conexão e tente de novo.</p></div>';
}
