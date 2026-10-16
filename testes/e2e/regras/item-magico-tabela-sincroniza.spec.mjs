// ============================================================
// Issue #143: item mágico com tabela gravado na 3.1.0 a 3.3.5 tinha linhas
// como array dentro de array, que o Firestore recusa. Abrir a ficha converte
// as linhas para { celulas } e o detalhe do item continua mostrando a tabela.
// ============================================================
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { montarItemInventario } from '../../../site/js/itens-magicos-catalogo.js';
import { celulasDaLinha } from '../../../site/js/regras-tabelas-item.js';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

const RAIZ = resolve(import.meta.dirname, '../../..');
const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const ANEL = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens.find((i) => i.id === 'anel-de-resistencia');

/** Item do inventário no formato gravado antes da correção: linhas da tabela como array. */
function anelFormatoAntigo() {
  const item = montarItemInventario({ item: ANEL, equipamentoPHB: [] });
  item.dados.tabelas = item.dados.tabelas.map((t) => ({ ...t, dados: t.dados.map(celulasDaLinha) }));
  return item;
}

/** Caminhos de todo array que aparece como elemento direto de outro array. */
function arraysAninhados(v, caminho = '') {
  if (Array.isArray(v)) {
    return v.flatMap((x, i) => (Array.isArray(x) ? [`${caminho}[${i}]`] : arraysAninhados(x, `${caminho}[${i}]`)));
  }
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => arraysAninhados(x, `${caminho}.${k}`));
  return [];
}

test('#143: ficha antiga com tabela de item mágico é migrada e o detalhe mostra a tabela', async ({ context }) => {
  const antigo = anelFormatoAntigo();
  expect(arraysAninhados(antigo).length, 'semente no formato antigo').toBeGreaterThan(0);
  const primeiraLinha = celulasDaLinha(ANEL.tabelas[0].dados[0]);

  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 1, atributos: ATRIBUTOS_REGRAS, inventario: [antigo],
  }, 'regras-143-tabela');

  // A migração roda depois dos carregamentos assíncronos da abertura da ficha.
  await expect.poll(async () => arraysAninhados(await personagemSalvo(page))).toEqual([]);
  const salvo = await personagemSalvo(page);
  expect(salvo.inventario[0].dados.tabelas[0].dados[0]).toEqual({ celulas: primeiraLinha });

  await page.locator('[data-info-inv-sheet]', { hasText: 'Anel de Resistência' }).first().click();
  const tabela = page.locator('#modal-overlay table').first();
  await expect(tabela).toBeVisible();
  for (const celula of primeiraLinha) await expect(tabela).toContainText(celula);
  expect(erros).toEqual([]);
});
