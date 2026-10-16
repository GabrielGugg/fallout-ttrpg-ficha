// ============================================================
// Tabelas de item mágico gravadas no inventário (issue #143).
//
// O acervo guarda cada linha de tabela como array de células, e o Firestore
// recusa array dentro de array. Na ficha, cada linha é gravada como
// { celulas: [...] }. Regra pura, sem DOM e sem ler `char`.
// ============================================================

/** Células de uma linha de tabela, no formato do acervo (array) ou no gravado ({ celulas }). */
export function celulasDaLinha(linha) {
  if (Array.isArray(linha)) return linha;
  return Array.isArray(linha?.celulas) ? linha.celulas : [];
}

/** Cópia das tabelas do acervo com cada linha no formato gravável ({ celulas }). */
export function tabelasParaGravar(tabelas) {
  return (Array.isArray(tabelas) ? tabelas : []).map(t => ({
    ...structuredClone(t),
    dados: (Array.isArray(t?.dados) ? t.dados : []).map(linha => ({ celulas: [...celulasDaLinha(linha)] })),
  }));
}

/**
 * Converte, no próprio inventário, as linhas de tabela ainda gravadas como array.
 * Retorna true se alterou algum item.
 */
export function normalizarTabelasInventario(inventario) {
  let alterou = false;
  for (const item of Array.isArray(inventario) ? inventario : []) {
    const tabelas = item?.dados?.tabelas;
    if (!Array.isArray(tabelas)) continue;
    if (!tabelas.some(t => Array.isArray(t?.dados) && t.dados.some(Array.isArray))) continue;
    item.dados.tabelas = tabelasParaGravar(tabelas);
    alterou = true;
  }
  return alterou;
}
