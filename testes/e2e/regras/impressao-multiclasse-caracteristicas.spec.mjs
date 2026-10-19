// ============================================================
// Issue #144: no PDF de uma ficha multiclasse, as características saíam só
// da classe inicial e filtradas pelo nível TOTAL. Guerreiro 3 / Bruxo 1
// saía como Guerreiro 4 (com o Aumento no Valor de Atributo do nível 4) e
// sem nenhuma característica do Bruxo.
//
// O PDF (`sheet/pdf.js`) extrai os blocos de detalhe do HTML de
// `gerarHtmlImpressao`, então o oráculo afirma sobre esse HTML.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

/** HTML que a ficha manda para a impressão e para o PDF. */
async function htmlDeImpressao(page) {
  return page.evaluate(async () => {
    const mod = await import(new URL('./js/sheet/impressao.js', location.href).href);
    return mod.gerarHtmlImpressao();
  });
}

/** Títulos e nomes de característica do HTML, em texto puro. */
async function textoDe(page, html) {
  return page.evaluate((h) => {
    const div = document.createElement('div');
    div.innerHTML = h;
    return div.textContent.replace(/\s+/g, ' ');
  }, html);
}

test('impressão de Guerreiro 3 / Bruxo 1 lista as características de cada classe pelo nível nela', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    nome: 'Leda', especie: 'Humano', classe: 'Guerreiro', subclasse: 'Campeão',
    nivel: 4, xp: 2700, atributos: ATRIBUTOS_REGRAS,
    classes: [
      { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 3, ordem: 0 },
      { classe: 'Bruxo', subclasse: '', nivel: 1, ordem: 1 },
    ],
    schema_versao: 2,
  }, 'regras-impressao-mc-144');
  await assentar(page).catch(() => {});

  const texto = await textoDe(page, await htmlDeImpressao(page));

  expect(texto).toContain('Características de Classe — Guerreiro 3');
  expect(texto).toContain('Características de Classe — Bruxo 1');
  expect(texto, 'característica de Bruxo 1').toContain('Magia de Pacto');
  expect(texto, 'característica de Bruxo 1').toContain('Invocações Místicas');
  expect(texto, 'característica de Guerreiro 2').toContain('Surto de Ação');
  expect(texto, 'Guerreiro 3 não tem a característica do nível 4')
    .not.toContain('Aumento no Valor de Atributo');
  expect(texto, 'Bruxo 1 não tem Astúcia Mágica (nível 2)').not.toContain('Astúcia Mágica');
  expect(texto).toContain('Subclasse — Campeão');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('impressão de classe única continua com o título sem nome de classe', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    nome: 'Solo', especie: 'Humano', classe: 'Guerreiro', subclasse: 'Campeão',
    nivel: 4, xp: 2700, atributos: ATRIBUTOS_REGRAS,
  }, 'regras-impressao-solo-144');
  await assentar(page).catch(() => {});

  const texto = await textoDe(page, await htmlDeImpressao(page));
  expect(texto).toContain('Características de Classe');
  expect(texto).not.toContain('Características de Classe — Guerreiro');
  expect(texto, 'Guerreiro 4 tem o Aumento no Valor de Atributo').toContain('Aumento no Valor de Atributo');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
