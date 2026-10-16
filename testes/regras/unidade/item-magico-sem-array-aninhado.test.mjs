// ============================================================
// Issue #143: o Firestore recusa array dentro de array ("Nested arrays are
// not supported"). Item mágico com tabela gravava `tabelas[].dados` como
// lista de linhas (arrays) e a ficha deixava de sincronizar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, RAIZ } from './harness.mjs';
import * as C from '../../../site/js/itens-magicos-catalogo.js';
import { celulasDaLinha, normalizarTabelasInventario } from '../../../site/js/regras-tabelas-item.js';

// O módulo de interface depende do ambiente de navegador que o harness monta.
await modulosApp();
const { htmlTabelasItemMagico } = await import('../../../site/js/itens-magicos-ui.js');

const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const ACERVO = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens;
const CATALOGOS = { armas: ler('dados/equipamento/armas.json').armas, armaduras: ler('dados/equipamento/armaduras.json').armaduras };
const PHB = ler('dados/equipamento/equipamento_aventura.json').itens;

/** Caminho do primeiro array encontrado diretamente dentro de outro array, ou null. */
function caminhoArrayAninhado(v, caminho = '') {
  if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) {
      if (Array.isArray(x)) return `${caminho}[${i}]`;
      const sub = caminhoArrayAninhado(x, `${caminho}[${i}]`);
      if (sub) return sub;
    }
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      const sub = caminhoArrayAninhado(x, `${caminho}.${k}`);
      if (sub) return sub;
    }
  }
  return null;
}

/** Monta o item do inventário como a ficha monta, com a primeira base válida quando o item exige uma. */
function montar(item) {
  const base = item.base ? C.opcoesDeBase(item.base, CATALOGOS)[0] || null : null;
  return C.montarItemInventario({ item, base, equipamentoPHB: PHB });
}

const COM_TABELA = ACERVO.filter((i) => (i.tabelas || []).length > 0);

test('o acervo tem itens com tabela (pré-condição do teste)', () => {
  assert.ok(COM_TABELA.length > 0);
});

test('#143: nenhum item mágico montado para o inventário tem array dentro de array', () => {
  const comDefeito = [];
  for (const item of COM_TABELA) {
    const caminho = caminhoArrayAninhado(JSON.parse(JSON.stringify(montar(item))));
    if (caminho) comDefeito.push(`${item.id} ${caminho}`);
  }
  assert.deepEqual(comDefeito, []);
});

test('#143: a tabela gravada no item mantém as células do acervo', () => {
  const item = COM_TABELA[0];
  const inv = montar(item);
  const gravadas = inv.dados.tabelas.map((t) => t.dados.map(celulasDaLinha));
  assert.deepEqual(gravadas, item.tabelas.map((t) => t.dados));
});

test('#143: ficha antiga com linhas em array é convertida e sai sem array aninhado', () => {
  const antigo = { nome: 'Anel', dados: { magico_id: 'x', tabelas: [{ titulo: 'T', cabecalhos: ['a', 'b'], dados: [['1', '2'], ['3', '4']] }] } };
  const inventario = [antigo, { nome: 'Corda', dados: {} }];
  assert.equal(normalizarTabelasInventario(inventario), true);
  assert.equal(caminhoArrayAninhado(inventario), null);
  assert.deepEqual(antigo.dados.tabelas[0].dados.map(celulasDaLinha), [['1', '2'], ['3', '4']]);
  assert.equal(normalizarTabelasInventario(inventario), false, 'segunda passada não altera nada');
});

test('#143: o detalhe desenha as linhas nos dois formatos (acervo e gravado)', () => {
  const doAcervo = htmlTabelasItemMagico([{ cabecalhos: ['a'], dados: [['x1']] }]);
  const gravado = htmlTabelasItemMagico([{ cabecalhos: ['a'], dados: [{ celulas: ['x1'] }] }]);
  assert.match(doAcervo, /<td>x1<\/td>/);
  assert.equal(gravado, doAcervo);
});
