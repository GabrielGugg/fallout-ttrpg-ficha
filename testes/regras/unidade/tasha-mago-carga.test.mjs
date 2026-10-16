// ============================================================
// db.js com o Mago do Tasha's: subclasse Lâmina Cantante, as 13 magias novas
// e a lista de magias adicionais (todas já presentes na lista do Mago).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modulosApp } from './harness.mjs';

const { db } = await modulosApp();
const nomesDaLista = (dados) => Object.values(dados.lista_magias).flat().map((m) => m.nome);
const lerJson = (p) => JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8'));
const novas = lerJson('dados/tasha/mago/magias.json').magias;
const adicionais = lerJson('dados/tasha/mago/magias_adicionais.json').magias;

test('getClasse("Mago") termina com a Lâmina Cantante', async () => {
  const mago = await db.getClasse('Mago');
  const ultima = mago.subclasses.at(-1);
  assert.equal(ultima.nome, 'Lâmina Cantante');
  assert.equal(ultima.fonte, 'tasha');
});

test('lista do Mago traz as 13 novas com fonte tasha e cada adicional uma só vez', async () => {
  await db.getMagiasClasse('Mago');
  const dados = await db.getMagiasClasse('Mago');
  const nomes = nomesDaLista(dados);
  const todas = Object.values(dados.lista_magias).flat();
  assert.equal(novas.length, 13);
  for (const n of novas) {
    const achadas = todas.filter((m) => m.nome === n.nome);
    assert.equal(achadas.length, 1, n.nome);
    assert.equal(achadas[0].fonte, 'tasha', n.nome);
  }
  assert.equal(adicionais.length, 23);
  for (const a of adicionais) assert.equal(nomes.filter((x) => x === a.nome).length, 1, a.nome);
});

test('cada uma das 13 novas está no grupo certo da lista do Mago, uma vez, com fonte tasha', async () => {
  await db.getMagiasClasse('Mago');
  const dados = await db.getMagiasClasse('Mago');
  for (const n of novas) {
    const grupo = dados.lista_magias[n.circulo === 0 ? 'Truques' : `${n.circulo}º Círculo`];
    const achadas = grupo.filter((m) => m.nome === n.nome);
    assert.equal(achadas.length, 1, n.nome);
    assert.equal(achadas[0].fonte, 'tasha', n.nome);
  }
});

test('índice e círculos: cada nova aparece uma vez, só com a classe Mago, mesmo após chamadas repetidas', async () => {
  await db.getIndiceMagias();
  const idx = await db.getIndiceMagias();
  for (const n of novas) {
    const noIndice = idx.magias.filter((m) => m.nome === n.nome);
    assert.equal(noIndice.length, 1, `índice ${n.nome}`);
    assert.deepEqual(noIndice[0].classes, ['Mago'], `índice ${n.nome}`);
    await db.getMagiasPorCirculo(n.circulo);
    const circ = await db.getMagiasPorCirculo(n.circulo);
    const doCirculo = circ.magias.filter((m) => m.nome === n.nome);
    assert.equal(doCirculo.length, 1, `círculo ${n.nome}`);
    assert.deepEqual(doCirculo[0].classes, ['Mago'], `círculo ${n.nome}`);
  }
});

test('Invocar Feérico (Conjure Fey, 6º) não entra no Mago; Convocar Feérico não duplica', async () => {
  const dados = await db.getMagiasClasse('Mago');
  assert.ok(!nomesDaLista(dados).includes('Invocar Feérico'));
  const idx = await db.getIndiceMagias();
  assert.ok(!idx.magias.find((m) => m.nome === 'Invocar Feérico').classes.includes('Mago'));
  const convocar = idx.magias.find((m) => m.nome === 'Convocar Feérico');
  assert.equal(convocar.classes.filter((c) => c === 'Mago').length, 1);
  assert.equal(db.fonteDaMagia('Lâmina Estrondosa'), 'tasha');
  const c3 = await db.getMagiasPorCirculo(3);
  assert.equal(c3.magias.filter((m) => m.nome === 'Mortalha Espiritual').length, 1);
});

test('listas de Bruxo e Feiticeiro não recebem as magias do Mago do Tasha', async () => {
  for (const classe of ['Bruxo', 'Feiticeiro']) {
    const nomes = nomesDaLista(await db.getMagiasClasse(classe));
    for (const n of novas) assert.ok(!nomes.includes(n.nome), `${classe}: ${n.nome}`);
  }
});

test('lista resumida do Mago (por_classe) traz as novas e não traz Invocar Feérico', async () => {
  const l = await db.getMagiasPorClasseLista('Mago');
  assert.ok(l.magias.some((m) => m.nome === 'Lâmina Estrondosa' && m.circulo === 0));
  assert.ok(l.magias.some((m) => m.nome === 'Lâmina do Desastre' && m.circulo === 9));
  assert.ok(!l.magias.some((m) => m.nome === 'Invocar Feérico'));
  assert.equal(l.total_magias, l.magias.length);
});
