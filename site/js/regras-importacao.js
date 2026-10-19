// ============================================================
// Relatório de importação de personagens (puro, sem DOM): texto copiável e
// link para abrir a issue no GitHub com o relato já preenchido.
// ============================================================

/** Repositório público do projeto, onde ficam as issues. */
const REPO_URL = 'https://github.com/ZaitBr-bit/D-D_2024';

/** Limite do texto embutido na URL da issue; URL longa demais o GitHub recusa. */
const MAX_TEXTO_URL = 3000;

/**
 * True se o resultado da importação merece o relatório de problema.
 * @param {{erro: string|null, ignorados: object[]}} resultado Saída de importarPersonagensDetalhado.
 * @returns {boolean}
 */
export function importacaoTeveProblema(resultado) {
  return Boolean(resultado?.erro) || (resultado?.ignorados?.length || 0) > 0;
}

/**
 * Monta o texto do relatório de importação, para o jogador copiar e anexar à issue.
 * @param {object} args
 * @param {{importados: string[], jaExistentes: string[], ignorados: object[], erro: string|null}} args.resultado
 * @param {string} args.versao Versão do app.
 * @param {string} args.arquivo Nome do arquivo escolhido.
 * @param {number} args.tamanho Tamanho do arquivo em bytes.
 * @param {string} args.navegador `navigator.userAgent`.
 * @param {string} args.data Instante ISO da tentativa.
 * @returns {string}
 */
export function textoRelatorioImportacao({ resultado, versao, arquivo, tamanho, navegador, data }) {
  const linhas = [
    'Erro ao importar personagem',
    `Versão: ${versao || '?'}`,
    `Data: ${data || '?'}`,
    `Navegador: ${navegador || '?'}`,
    `Arquivo: ${arquivo || '?'} (${tamanho ?? '?'} bytes)`,
  ];
  if (resultado.erro) linhas.push(`Erro: ${resultado.erro}`);
  linhas.push(`Importados: ${resultado.importados.length}${resultado.importados.length ? ` (${resultado.importados.join(', ')})` : ''}`);
  if (resultado.jaExistentes.length) linhas.push(`Já existiam: ${resultado.jaExistentes.join(', ')}`);
  if (resultado.ignorados.length) {
    linhas.push(`Ignorados: ${resultado.ignorados.length}`);
    for (const i of resultado.ignorados) {
      linhas.push(`- posição ${i.indice + 1}: ${i.nome ?? '(sem nome)'} [id ${i.id ?? '?'}] — ${i.motivo}`);
    }
  }
  return linhas.join('\n');
}

/**
 * Link para abrir a issue de bug com versão, local e relatório preenchidos.
 * Os parâmetros casam com os ids de `.github/ISSUE_TEMPLATE/bug.yml`.
 * @param {string} texto Relatório de textoRelatorioImportacao.
 * @param {string} versao Versão do app.
 * @returns {string}
 */
export function urlIssueImportacao(texto, versao) {
  const relato = texto.length > MAX_TEXTO_URL ? `${texto.slice(0, MAX_TEXTO_URL)}\n(...relatório cortado; cole o texto completo copiado)` : texto;
  const params = new URLSearchParams({
    template: 'bug.yml',
    title: '[Bug] Erro ao importar personagem',
    versao: versao || '',
    onde: 'Tela inicial (lista de personagens)',
    passos: '1. Na tela inicial, cliquei em Importar\n2. Escolhi o arquivo .json da ficha',
    esperado: 'O personagem ser importado.',
    aconteceu: relato,
    extras: 'Anexe aqui o arquivo .json da ficha que não importou (arraste o arquivo para esta caixa).',
  });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
