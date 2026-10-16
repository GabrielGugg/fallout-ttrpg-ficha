// ============================================================
// Lâmina Cantante nv 3, Treinamento na Guerra e na Música: Armadura Leve e
// Atuação automáticas; 1 arma Marcial corpo a corpo sem Duas Mãos à escolha.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ, modulosApp } from './harness.mjs';

const { regrasSubclasseEscolhas: esc } = await modulosApp();
const { temProficienciaArma } = await import('../../../site/js/regras-equipamento.js');
const armas = JSON.parse(readFileSync(resolve(RAIZ, 'dados/equipamento/armas.json'), 'utf-8')).armas;

test('lista literal bate com as Marciais corpo a corpo sem Duas Mãos do catálogo', () => {
  const doCatalogo = armas
    .filter((a) => a.categoria === 'Armas Marciais Corpo a Corpo' && !/Duas Mãos/.test(a.propriedades || ''))
    .map((a) => a.nome).sort();
  assert.deepEqual([...esc.ARMAS_LAMINA_CANTANTE].sort(), doCatalogo);
  assert.equal(esc.ARMAS_LAMINA_CANTANTE.length, 11);
});

test('nível 3: linha automática e linha de escolha', () => {
  const linhas = esc.linhasDaSubclasseNoNivel('Lâmina Cantante', 3, new Set());
  const auto = linhas.find((l) => l.automatica);
  const escolha = linhas.find((l) => l.tipo === 'subclasse_lamina_arma');
  const p = { pericias_proficientes: ['Atuação'], proficiencias_extra: [] };
  esc.aplicarConcessaoAutomatica(p, auto, { classe: 'Mago' });
  assert.deepEqual(p.proficiencias_extra, ['Armadura Leve']);
  assert.deepEqual(p.pericias_proficientes, ['Atuação'], 'Atuação não duplica');
  assert.deepEqual(esc.opcoesDaLinha(escolha), esc.ARMAS_LAMINA_CANTANTE);
  esc.aplicarEscolhaSubclasse(p, escolha, ['Rapieira'], { classe: 'Mago' });
  assert.deepEqual(p.proficiencias_extra, ['Armadura Leve', 'Rapieira']);
});

test('proficiência pelo nome da arma; outra Marcial continua sem', () => {
  const p = { classes: [{ classe: 'Mago', nivel: 3, subclasse: 'Lâmina Cantante', ordem: 0 }], classe: 'Mago', proficiencias_extra: ['Rapieira'] };
  assert.equal(temProficienciaArma(p, { nome: 'Rapieira', categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Acuidade' }), true);
  assert.equal(temProficienciaArma(p, { nome: 'Espada Longa', categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Versátil (1d10)' }), false);
});

test('assinatura categoria+dano+propriedades+maestria é única nas armas do catálogo', () => {
  const chaves = armas.map((a) => [a.categoria, a.dano, a.propriedades || '', a.maestria || ''].join('|'));
  assert.equal(new Set(chaves).size, armas.length);
});

const PROF_RAPIEIRA = { classes: [{ classe: 'Mago', nivel: 3, subclasse: 'Lâmina Cantante', ordem: 0 }], classe: 'Mago', proficiencias_extra: ['Rapieira'] };
const RAPIEIRA = armas.find((a) => a.nome === 'Rapieira');
const COMO_RAPIEIRA = { categoria: RAPIEIRA.categoria, dano: RAPIEIRA.dano, propriedades: RAPIEIRA.propriedades, maestria: RAPIEIRA.maestria };

test('arma renomeada com a assinatura da Rapieira mantém a proficiência', () => {
  assert.equal(temProficienciaArma(PROF_RAPIEIRA, { nome: 'Minha Florete', ...COMO_RAPIEIRA }, armas), true);
});

test('mesmo nome renomeado, mas com dano diferente, não herda a proficiência', () => {
  assert.equal(temProficienciaArma(PROF_RAPIEIRA, { nome: 'Minha Florete', ...COMO_RAPIEIRA, dano: '1d10 Perfurante' }, armas), false);
});

test('Marcial sem relação com a Rapieira continua sem proficiência', () => {
  const espada = armas.find((a) => a.nome === 'Espada Longa');
  assert.equal(temProficienciaArma(PROF_RAPIEIRA, { nome: 'Espada Boa', categoria: espada.categoria, dano: espada.dano, propriedades: espada.propriedades, maestria: espada.maestria }, armas), false);
});

test('cards da Lâmina: catálogo ausente ou vazio cai para a lista de nomes', () => {
  const nomes = esc.ARMAS_LAMINA_CANTANTE;
  assert.deepEqual(esc.armasDaLinhaOuNomes(null, nomes).map((a) => a.nome), nomes);
  assert.deepEqual(esc.armasDaLinhaOuNomes({ armas: [] }, nomes).map((a) => a.nome), nomes);
  const comCatalogo = esc.armasDaLinhaOuNomes({ armas }, nomes);
  assert.equal(comCatalogo.length, 11);
  assert.ok(comCatalogo.every((a) => a.dano), 'com catálogo, as armas trazem dano');
});

test('sem catálogo ou sem dano/maestria, o nome continua sendo o único critério', () => {
  assert.equal(temProficienciaArma(PROF_RAPIEIRA, { nome: 'Minha Florete', ...COMO_RAPIEIRA }), false);
  assert.equal(temProficienciaArma(PROF_RAPIEIRA, { nome: 'Minha Florete', categoria: RAPIEIRA.categoria, propriedades: RAPIEIRA.propriedades }, armas), false);
});
