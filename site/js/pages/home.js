// ============================================================
// Tela inicial: lista de personagens, importar e exportar
// ============================================================
import { listarPersonagens, removerPersonagem, duplicarPersonagem, exportar, importar } from '../store.js';
import { escHtml, abrirModal, fecharModal, toast, baixarArquivo, fmtData } from '../utils.js';

const NOMES_RACA = {
  humano: 'Humano', necrotico: 'Necrótico', sintetico: 'Sintético Gen 2', robo: 'Robô', super_mutante: 'Super Mutante',
};

/** Desenha a tela inicial. */
export function renderHome(container) {
  const lista = listarPersonagens().sort((a, b) => (b.atualizado_em || '').localeCompare(a.atualizado_em || ''));
  container.innerHTML = `
    <div class="home">
      <div class="home-acoes">
        <button class="btn btn-primary btn-lg" id="btn-novo">+ Novo personagem</button>
        <div class="home-acoes-sec">
          <button class="btn btn-secondary btn-sm" id="btn-importar">Importar</button>
          ${lista.length ? '<button class="btn btn-secondary btn-sm" id="btn-exportar-todos">Exportar todos</button>' : ''}
        </div>
        <input type="file" id="input-importar" accept=".json,application/json" hidden>
      </div>
      ${lista.length ? `<div class="char-list">${lista.map(cardPersonagem).join('')}</div>` : `
        <div class="empty-state">
          <div class="empty-icone">☢</div>
          <h2>Nenhum personagem ainda</h2>
          <p>Crie seu primeiro habitante do ermo. As fichas ficam salvas neste aparelho.</p>
        </div>`}
    </div>`;

  container.querySelector('#btn-novo').onclick = () => window.navegar('criar');
  container.querySelector('#btn-exportar-todos')?.addEventListener('click', () => {
    baixarArquivo(new Blob([exportar()], { type: 'application/json' }), 'personagens-fallout.json');
  });
  const input = container.querySelector('#input-importar');
  container.querySelector('#btn-importar').onclick = () => input.click();
  input.onchange = async () => {
    const arq = input.files[0];
    if (!arq) return;
    try {
      const { importados, ignorados } = importar(await arq.text());
      toast(`${importados} importado(s)${ignorados ? `, ${ignorados} ignorado(s) por não serem fichas de Fallout` : ''}.`, 'sucesso');
      renderHome(container);
    } catch {
      toast('Arquivo inválido.', 'erro');
    }
  };
  container.querySelectorAll('[data-home-acao]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const acao = btn.dataset.homeAcao;
      if (acao === 'abrir') window.navegar(`ficha/${id}`);
      if (acao === 'duplicar') { duplicarPersonagem(id); renderHome(container); }
      if (acao === 'exportar') {
        const p = lista.find(x => x.id === id);
        baixarArquivo(new Blob([exportar(id)], { type: 'application/json' }), `${(p?.nome || 'personagem').replace(/[^\w-]+/g, '_')}.json`);
      }
      if (acao === 'remover') confirmarRemocao(id, container);
    };
  });
}

/** Card de um personagem na lista. */
function cardPersonagem(p) {
  return `
    <div class="char-card" data-home-acao="abrir" data-id="${escHtml(p.id)}">
      <div class="char-avatar">${escHtml((p.nome || '?').charAt(0).toUpperCase())}</div>
      <div class="char-info">
        <div class="char-nome">${escHtml(p.nome || 'Sem nome')}</div>
        <div class="char-detalhe">${escHtml(NOMES_RACA[p.raca] || '')} · Nível ${p.nivel || 1}</div>
        <div class="char-data">Atualizado em ${fmtData(p.atualizado_em)}</div>
      </div>
      <div class="char-botoes">
        <button class="btn-icon" title="Duplicar" data-home-acao="duplicar" data-id="${escHtml(p.id)}">⧉</button>
        <button class="btn-icon" title="Exportar" data-home-acao="exportar" data-id="${escHtml(p.id)}">⇩</button>
        <button class="btn-icon perigo" title="Excluir" data-home-acao="remover" data-id="${escHtml(p.id)}">✕</button>
      </div>
    </div>`;
}

/** Pede confirmação antes de excluir. */
function confirmarRemocao(id, container) {
  const p = listarPersonagens().find(x => x.id === id);
  abrirModal('Excluir personagem', `<p>Excluir <strong>${escHtml(p?.nome || 'este personagem')}</strong>? Não dá para desfazer.</p>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-confirmar-remocao">Excluir</button>');
  document.getElementById('btn-confirmar-remocao').onclick = () => {
    removerPersonagem(id);
    fecharModal();
    renderHome(container);
  };
}
