// ============================================================
// Issue #145: ficha importada por JSON aparece e some ("personagem não
// encontrado" ao clicar). O arquivo traz o `atualizado_em` de quando foi
// exportado; se o mesmo id foi excluído depois (lápide na nuvem), a
// reconciliação da home tira a ficha recém-importada. Importar é uma ação
// do jogador agora, então a cópia importada tem de vencer a lápide antiga.
//
// Também cobre o relatório de importação: o que entrou, o que já existia e
// o que foi ignorado, para a tela mostrar o erro em vez de só "0 importados".
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { RAIZ, modulosApp } from './harness.mjs';

const merge = await import(pathToFileURL(resolve(RAIZ, 'site/js/sync-merge.js')).href);

/** Roda `fn` com a lista local de personagens vazia e restaura depois. */
async function comListaVazia(fn) {
  const original = localStorage.getItem('dnd_personagens');
  localStorage.setItem('dnd_personagens', '[]');
  try { return await fn(); } finally {
    if (original === null) localStorage.removeItem('dnd_personagens');
    else localStorage.setItem('dnd_personagens', original);
  }
}

const FICHA = { id: 'imp-145', nome: 'Kassai', nivel: 3, classe: 'Mago', atributos: { forca: 10 }, atualizado_em: '2026-10-01T10:00:00.000Z' };

test('#145: ficha importada vence a lápide da nuvem gravada depois da exportação', async () => {
  const { store } = await modulosApp();
  await comListaVazia(() => {
    assert.equal(store.importarPersonagens(JSON.stringify([FICHA])), 1);
    const local = store.listarPersonagens();
    const lapide = { id: FICHA.id, removido: true, removido_em: '2026-10-10T10:00:00.000Z', atualizado_em: '2026-10-10T10:00:00.000Z' };
    const { lista, idsRemovidosLocal } = merge.reconciliar({ locais: local, nuvem: [lapide], idsPendentesRemocao: new Set() });
    assert.deepEqual(idsRemovidosLocal, [], 'a lápide antiga removeu a ficha recém-importada');
    assert.ok(lista.find((p) => p.id === FICHA.id));
    assert.equal(merge.decidirAoAbrir(local[0], lapide), 'manter', 'abrir a ficha importada daria "personagem não encontrado"');
  });
});

test('importarPersonagensDetalhado: separa importados, já existentes e ignorados', async () => {
  const { store } = await modulosApp();
  await comListaVazia(() => {
    store.importarPersonagens(JSON.stringify([FICHA]));
    const r = store.importarPersonagensDetalhado(JSON.stringify([
      FICHA,
      { ...FICHA, id: 'imp-145-b', nome: 'Nova' },
      { id: 'imp-145-ruim', nome: 'Sem atributos', nivel: 2 },
      'texto solto',
    ]));
    assert.equal(r.erro, null);
    assert.deepEqual(r.importados, ['Nova']);
    assert.deepEqual(r.jaExistentes, ['Kassai']);
    assert.deepEqual(r.ignorados.map((i) => i.indice), [2, 3]);
    assert.equal(r.ignorados[0].nome, 'Sem atributos');
    assert.match(r.ignorados[0].motivo, /atributos/);
  });
});

test('importarPersonagensDetalhado: arquivo que não é JSON ou não é lista devolve o erro', async () => {
  const { store } = await modulosApp();
  await comListaVazia(() => {
    const quebrado = store.importarPersonagensDetalhado('{ "id": ');
    assert.ok(quebrado.erro, 'JSON quebrado tem de devolver erro');
    assert.deepEqual(quebrado.importados, []);
    const objeto = store.importarPersonagensDetalhado(JSON.stringify(FICHA));
    assert.match(objeto.erro, /lista/);
    assert.equal(store.importarPersonagens('{ "id": '), -1, 'a função antiga continua devolvendo -1');
  });
});
