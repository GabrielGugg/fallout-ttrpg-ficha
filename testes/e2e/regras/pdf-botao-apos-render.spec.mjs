// ============================================================
// Issue #144 (segundo relato) e #142: "clico em Gerar PDF e nada acontece;
// depois de recarregar a página o download sai".
//
// `renderFichaCompleta` reescreve o innerHTML da ficha, inclusive o
// `#btn-print`, e o listener dele era ligado uma vez só, em `renderSheet`.
// Qualquer ação que re-renderiza a ficha deixava o botão sem listener até
// recarregar. Este spec re-renderiza por clique (Inspiração Heroica) e
// depois clica no botão de verdade.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirBlocosRecursos, abrirFicha, assentar } from './helpers-regras.mjs';

const BASE = {
  classe: 'Guerreiro', nivel: 2, xp: 300, atributos: ATRIBUTOS_REGRAS,
  nome: 'PDF depois do render', especie: 'Humano', antecedente: 'Soldado',
};

/** Abre o bloco recolhido do cabeçalho, onde fica o botão "Gerar PDF". */
async function abrirDetalhesCabecalho(page) {
  await page.click('[data-details-id="ficha-identidade"] > summary');
  await expect(page.locator('#btn-print')).toBeVisible();
}

test('Gerar PDF continua baixando depois de a ficha re-renderizar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, BASE, 'regras-pdf-apos-render');
  await assentar(page).catch(() => {});

  // Re-render real: o toggle de Inspiração Heroica chama renderFichaCompleta.
  await page.click('#inspiracao-toggle');
  await expect(page.locator('#inspiracao-toggle.hp-inspiracao-ativa')).toBeVisible();

  await abrirDetalhesCabecalho(page);
  const espera = page.waitForEvent('download', { timeout: 30_000 });
  await page.click('#btn-print');
  const download = await espera;
  expect(download.suggestedFilename()).toBe('Ficha PDF depois do render.pdf');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// Mesmo defeito: "Escolher agora" (manobras pendentes) também era ligado uma vez só.
test('Escolher agora (manobras pendentes) abre a grade depois de a ficha re-renderizar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...BASE, nome: 'Mestre', nivel: 3, xp: 900, subclasse: 'Mestre da Batalha', manobras_conhecidas: [],
  }, 'regras-manobras-apos-render');
  await assentar(page).catch(() => {});

  await page.click('#inspiracao-toggle');
  await expect(page.locator('#inspiracao-toggle.hp-inspiracao-ativa')).toBeVisible();

  await abrirBlocosRecursos(page);
  await page.click('#btn-escolher-manobras-pendentes');
  await expect(page.locator('#grid-manobras')).toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
