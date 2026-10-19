// ============================================================
// Home: importar arquivo com problema mostra o relatório copiável.
//
// Antes, arquivo quebrado dava só o toast "Erro ao importar arquivo" e ficha
// inválida era ignorada em silêncio ("0 personagem(ns) importado(s)"). Agora
// abre o popup "Problema ao importar" com o relatório (versão, navegador,
// arquivo, motivo por ficha), o botão Copiar e o link "Relatar problema",
// que abre a issue já preenchida e pede o .json da ficha.
// ============================================================
import { expect, test } from '@playwright/test';
import { ATRIBUTOS_REGRAS, NOVO, abrirSite, assentar } from './helpers-regras.mjs';

/** Clica em Importar na home e entrega o arquivo ao seletor. */
async function importarArquivo(page, nome, conteudo) {
  const escolhendo = page.waitForEvent('filechooser');
  await page.locator('#btn-importar').click();
  const seletor = await escolhendo;
  await seletor.setFiles({ name: nome, mimeType: 'application/json', buffer: Buffer.from(conteudo, 'utf-8') });
}

test('home: arquivo que não é JSON abre o relatório, copia e aponta para a issue', async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { page, erros } = await abrirSite(context);
  await page.goto(NOVO, { waitUntil: 'domcontentloaded' });
  await assentar(page);

  await importarArquivo(page, 'ficha-quebrada.json', '{ "id": "x", ');

  const texto = page.locator('#texto-erro-importacao');
  await expect(texto).toBeVisible();
  await expect(texto).toHaveValue(/Erro ao importar personagem/);
  await expect(texto).toHaveValue(/Arquivo: ficha-quebrada\.json/);
  await expect(texto).toHaveValue(/Erro: /);

  await page.click('#btn-copiar-erro-importacao');
  await expect(page.locator('.toast', { hasText: 'Relatório copiado.' })).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado).toContain('Arquivo: ficha-quebrada.json');

  const href = await page.locator('#link-issue-importacao').getAttribute('href');
  const url = new URL(href);
  expect(url.pathname).toBe('/ZaitBr-bit/D-D_2024/issues/new');
  expect(url.searchParams.get('template')).toBe('bug.yml');
  expect(url.searchParams.get('aconteceu')).toContain('Arquivo: ficha-quebrada.json');
  expect(url.searchParams.get('extras')).toContain('.json');

  expect(erros.filter((e) => !e.includes('Erro ao importar')),
    `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('home: ficha inválida no meio do arquivo entra no relatório e a válida é importada', async ({ context }) => {
  const { page, erros } = await abrirSite(context);
  await page.goto(NOVO, { waitUntil: 'domcontentloaded' });
  await assentar(page);

  await importarArquivo(page, 'duas-fichas.json', JSON.stringify([
    { id: 'imp-ok', nome: 'Válida', classe: 'Guerreiro', nivel: 2, atributos: ATRIBUTOS_REGRAS },
    { id: 'imp-ruim', nome: 'Sem Atributos', classe: 'Mago', nivel: 3 },
  ]));

  await expect(page.locator('#texto-erro-importacao')).toHaveValue(/Ignorados: 1/);
  await expect(page.locator('#texto-erro-importacao')).toHaveValue(/Sem Atributos \[id imp-ruim\] — sem atributos/);
  await page.locator('#modal-overlay button', { hasText: 'Fechar' }).click();
  await expect(page.locator('.char-card')).toHaveCount(1);
  await expect(page.locator('.char-card').first()).toContainText('Válida');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
