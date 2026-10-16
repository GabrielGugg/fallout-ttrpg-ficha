// ============================================================
// Lâmina Cantante (Mago, Tasha's): escolha da arma na subida para o 3,
// Canção da Lâmina, Canção da Defesa e magias novas na lista. Todos CLICAM.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, lerToastErro, personagemSalvo } from './helpers-regras.mjs';

const XP_POR_NIVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000];

/** Mago Lâmina Cantante do nível dado, Des 14, Int 16, com o inventário dado. */
const MAGO_LAMINA = (nivel, extra = {}) => ({
  classe: 'Mago', subclasse: nivel >= 3 ? 'Lâmina Cantante' : '', nivel, xp: XP_POR_NIVEL[nivel - 1] ?? 165000,
  atributos: { ...ATRIBUTOS_REGRAS, destreza: 14, inteligencia: 16 }, pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }], magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1, classe: 'Mago' }],
  inventario: [], ...extra,
});

/** Clica em "Próximo" e espera o modal reagir. Devolve false se o botão sumiu. */
async function proximo(page) {
  const botao = page.locator('#btn-step-proximo');
  if (!await botao.count()) return false;
  await botao.click();
  await assentar(page).catch(() => {});
  return true;
}

test('subida para o 3: Lâmina Cantante com selo e seletor das 11 armas', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_LAMINA(2), 'lamina-subida');
  expect(await abrirModalLevelUp(page)).toBe(true);
  await proximo(page);
  const card = page.locator('[data-subclasse="Lâmina Cantante"]');
  await expect(card).toBeVisible();
  await expect(card.locator('.selo-fonte')).toHaveText('Sup. 1');
  await card.click();
  await assentar(page).catch(() => {});
  const cartoes = page.locator('[data-subclasse-cartoes="subclasse_lamina_arma"]');
  for (let i = 0; i < 4 && !(await cartoes.count()); i++) {
    if (!await proximo(page)) break;
  }
  await expect(cartoes).toHaveCount(1);
  // A escolha é por cards (não há select) e nasce sem seleção.
  await expect(page.locator('select[data-subclasse-escolha="subclasse_lamina_arma"]')).toHaveCount(0);
  await expect(cartoes.locator('[data-opcao]')).toHaveCount(11);
  await expect(cartoes.locator('.opcao-card.selecionada')).toHaveCount(0);
  // Clicar no corpo do card abre o popup com as propriedades da arma, sem selecionar.
  await cartoes.locator('[data-opcao="Rapieira"] .opcao-nome').click();
  const popup = page.locator('.sub-modal-overlay, #modal-corpo').filter({ hasText: 'Propriedades' }).last();
  await expect(popup).toContainText('Acuidade');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.querySelectorAll('.sub-modal-overlay').forEach((e) => e.remove()); });
  await expect(cartoes.locator('.opcao-card.selecionada')).toHaveCount(0);
  await cartoes.locator('[data-opcao="Rapieira"] .opcao-check').click();
  await expect(cartoes.locator('.opcao-card.selecionada')).toHaveCount(1);
  for (let i = 0; i < 8; i++) {
    // No passo do Grimório, escolhe 2 magias novas de 1º círculo (o passo exige).
    const abrirGrimorio = page.locator('#btn-lvlup-grimorio');
    if (await abrirGrimorio.count()) {
      await abrirGrimorio.click();
      await page.evaluate(() => { document.querySelectorAll('[data-grid-circulo="1"]').forEach((d) => { d.open = true; }); });
      for (const nome of ['Escudo Arcano', 'Detectar Magia']) await page.locator(`[data-grid-nome="${nome}"] [data-grid-check]`).first().click();
      await page.getByRole('button', { name: 'Confirmar Seleção' }).click();
      await assentar(page).catch(() => {});
    }
    if (!await proximo(page)) break;
  }
  const confirmar = page.locator('#btn-confirmar-levelup');
  await expect(confirmar, 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  await confirmar.click();
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.nivel).toBe(3);
  expect(salvo.proficiencias_extra).toEqual(expect.arrayContaining(['Armadura Leve', 'Rapieira']));
  expect(salvo.pericias_proficientes).toContain('Atuação');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('subida para o 3: se armas.json falhar, os 11 cards aparecem pelos nomes e dá para escolher', async ({ context }) => {
  await context.route(/armas\.json/, (rota) => rota.abort());
  const { page } = await abrirFicha(context, MAGO_LAMINA(2), 'lamina-sem-armas');
  expect(await abrirModalLevelUp(page)).toBe(true);
  await proximo(page);
  await page.locator('[data-subclasse="Lâmina Cantante"]').click();
  await assentar(page).catch(() => {});
  const cartoes = page.locator('[data-subclasse-cartoes="subclasse_lamina_arma"]');
  for (let i = 0; i < 4 && !(await cartoes.count()); i++) {
    if (!await proximo(page)) break;
  }
  await expect(cartoes.locator('[data-opcao]')).toHaveCount(11);
  await cartoes.locator('[data-opcao="Rapieira"] .opcao-check').click();
  await expect(cartoes.locator('.opcao-card.selecionada')).toHaveCount(1);
});

const ESCUDO = { nome: 'Escudo', tipo: 'armadura', quantidade: 1, equipado: false, dados: { categoria: 'Escudo', ca: '+2' } };

/** Texto do valor de um stat-box da ficha pelo rótulo. */
async function stat(page, rotulo) {
  return (await page.locator('.stat-box', { has: page.locator('.stat-label', { hasText: new RegExp(`^${rotulo}$`) }) }).locator('.stat-value').innerText()).trim();
}

/** Abre o card da Canção (nasce fechado). */
async function abrirCardCancao(page) {
  await page.locator('[data-details-id="lamina-cantante"]').waitFor({ state: 'attached' });
  await page.evaluate(() => { const d = document.querySelector('[data-details-id="lamina-cantante"]'); if (d) d.open = true; });
}

test('Canção da Lâmina: ativar sobe CA e deslocamento, encerrar volta', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_LAMINA(3), 'lamina-cancao');
  await abrirCardCancao(page);
  const caAntes = Number(await stat(page, 'CA'));
  const deslAntes = parseFloat((await stat(page, 'Deslocamento')).replace(',', '.'));
  await page.locator('[data-cancao-acao="ativar"]').click();
  await assentar(page).catch(() => {});
  expect(Number(await stat(page, 'CA'))).toBe(caAntes + 3);
  expect(parseFloat((await stat(page, 'Deslocamento')).replace(',', '.'))).toBe(deslAntes + 3);
  await abrirCardCancao(page);
  await expect(page.locator('[data-details-id="lamina-cantante"]')).toContainText('1/2');
  await page.locator('[data-cancao-acao="encerrar"]').click();
  await assentar(page).catch(() => {});
  expect(Number(await stat(page, 'CA'))).toBe(caAntes);
  expect(parseFloat((await stat(page, 'Deslocamento')).replace(',', '.'))).toBe(deslAntes);
  expect((await personagemSalvo(page)).recursos.mago.subclasses.lamina_cantante).toEqual({ ativa: false, usos_gastos: 1 });
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('equipar escudo com a Canção ativa encerra a Canção', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_LAMINA(3, { inventario: [ESCUDO] }), 'lamina-escudo');
  await abrirCardCancao(page);
  await page.locator('[data-cancao-acao="ativar"]').click();
  await assentar(page).catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
  await page.locator('[data-sheet-equip="0"]').check();
  await assentar(page).catch(() => {});
  expect((await personagemSalvo(page)).recursos.mago.subclasses.lamina_cantante.ativa).toBe(false);
  await abrirCardCancao(page);
  await expect(page.locator('[data-cancao-acao="ativar"]')).toBeDisabled();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Canção da Defesa (nível 10): gasta o espaço escolhido e mostra a redução', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_LAMINA(10), 'lamina-defesa');
  await abrirCardCancao(page);
  await page.locator('[data-cancao-acao="ativar"]').click();
  await assentar(page).catch(() => {});
  await abrirCardCancao(page);
  await page.locator('[data-cancao-acao="defesa"]').click();
  const card3 = page.locator('[data-cancao-defesa-circulo="conjuracao:3"]');
  await expect(card3).toBeVisible();
  await expect(card3).toContainText('15');
  await card3.click();
  await assentar(page).catch(() => {});
  const salvo = await personagemSalvo(page);
  expect(salvo.espacos_magia.conjuracao['3']).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('lista de magias do Mago mostra Lâmina Estrondosa com selo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_LAMINA(3), 'lamina-lista');
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
  await page.locator('#btn-add-magia').click();
  await assentar(page).catch(() => {});
  await page.locator('[data-tab-mg="truques"]').click();
  await assentar(page).catch(() => {});
  const item = page.locator('.opcao-card', { hasText: 'Lâmina Estrondosa' }).first();
  await expect(item).toBeVisible();
  await expect(item.locator('.selo-fonte')).toHaveText('Sup. 1');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
