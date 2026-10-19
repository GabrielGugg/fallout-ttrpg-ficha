// ============================================================
// Resultado da importação de personagens na home: toast quando deu certo,
// popup com o relatório copiável e link para abrir a issue quando não deu.
// ============================================================
import { importacaoTeveProblema, textoRelatorioImportacao, urlIssueImportacao } from './regras-importacao.js';
import { copiarTexto } from './sync-erro-ui.js';
import { abrirModal, escHtml, toast } from './utils.js';
import { VERSAO_ATUAL } from './versao.js';

/**
 * Avisa o jogador do resultado de importarPersonagensDetalhado.
 * @param {{importados: string[], jaExistentes: string[], ignorados: object[], erro: string|null}} resultado
 * @param {{name?: string, size?: number}} arquivo Arquivo escolhido no seletor.
 */
export function mostrarResultadoImportacao(resultado, arquivo) {
  if (!importacaoTeveProblema(resultado)) {
    if (resultado.importados.length) toast(`${resultado.importados.length} personagem(ns) importado(s)!`, 'success');
    else if (resultado.jaExistentes.length) toast(`Nenhum personagem novo: ${resultado.jaExistentes.join(', ')} já estava(m) na lista.`, 'info');
    else toast('O arquivo não tem nenhum personagem.', 'info');
    return;
  }
  abrirRelatorioImportacao(resultado, arquivo);
}

/** Abre o popup com o relatório da importação, botão Copiar e link para relatar o problema. */
function abrirRelatorioImportacao(resultado, arquivo) {
  const texto = textoRelatorioImportacao({
    resultado, versao: VERSAO_ATUAL, arquivo: arquivo?.name, tamanho: arquivo?.size,
    navegador: navigator.userAgent, data: new Date().toISOString(),
  });
  const parcial = resultado.importados.length
    ? `<p style="font-size:0.85rem">${resultado.importados.length} personagem(ns) entraram; os demais foram ignorados.</p>` : '';
  abrirModal('Problema ao importar', `
    ${parcial}
    <p style="font-size:0.85rem">Copie o relatório abaixo e abra um problema no GitHub. <strong>Anexe o arquivo .json da ficha</strong> ao relato: sem ele não dá para investigar.</p>
    <textarea id="texto-erro-importacao" class="form-input" readonly rows="10"
      style="width:100%;font-family:monospace;font-size:0.72rem;white-space:pre-wrap">${escHtml(texto)}</textarea>`,
  '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>'
    + '<button class="btn btn-secondary" id="btn-copiar-erro-importacao">Copiar</button>'
    + `<a class="btn btn-primary" id="link-issue-importacao" href="${escHtml(urlIssueImportacao(texto, VERSAO_ATUAL))}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Relatar problema</a>`);
  document.getElementById('btn-copiar-erro-importacao')?.addEventListener('click', async () => {
    const copiou = await copiarTexto(texto, document.getElementById('texto-erro-importacao'));
    toast(copiou ? 'Relatório copiado.' : 'Toque no texto, selecione tudo e copie.', copiou ? 'success' : 'info');
  });
}
