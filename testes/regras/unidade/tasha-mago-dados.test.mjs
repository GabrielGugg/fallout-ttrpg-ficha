// ============================================================
// Mago do Tasha's: magias novas, lista adicional de 23 e Lâmina Cantante.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
const indice = ler('dados/magias/_indice.json').magias;
const novas = ler('dados/tasha/mago/magias.json').magias;
const adicionais = ler('dados/tasha/mago/magias_adicionais.json');
const lamina = ler('dados/tasha/mago/subclasses_mago.json').subclasses.find((s) => s.nome === 'Lâmina Cantante');

// Cabeçalho das 13 magias (tabela do PDF p. 104, com as correções do spec, seção 2).
const ESPERADAS = [
  ['Chicote Elétrico', 0, 'Evocação'], ['Farpa Mental', 0, 'Encantamento'],
  ['Lâmina da Chama Esverdeada', 0, 'Evocação'], ['Lâmina Estrondosa', 0, 'Evocação'],
  ['Rompante de Espadas', 0, 'Invocação'], ['Beberagem Cáustica de Tasha', 1, 'Evocação'],
  ['Chicote Mental de Tasha', 2, 'Encantamento'], ['Fortaleza Intelectual', 3, 'Abjuração'],
  ['Invocar Prole Sombria', 3, 'Invocação'], ['Mortalha Espiritual', 3, 'Necromancia'],
  ['Disfarce Sobrenatural de Tasha', 6, 'Transmutação'], ['Sonho do Véu Azul', 7, 'Invocação'],
  ['Lâmina do Desastre', 9, 'Invocação'],
];

test('as 13 magias novas: nome, círculo, escola, fonte e classes', () => {
  assert.deepEqual(novas.map((m) => [m.nome, m.circulo, m.escola]).sort(), [...ESPERADAS].sort());
  for (const m of novas) {
    assert.equal(m.fonte, 'tasha', m.nome);
    assert.deepEqual(m.classes, ['Mago'], m.nome);
    assert.ok(m.nome_en && m.descricao && m.tempo_conjuracao && m.alcance && m.componentes && m.duracao, `campos de ${m.nome}`);
    assert.ok(!indice.some((x) => x.nome === m.nome), `${m.nome} já existe no Livro do Jogador`);
  }
});

test('texto das magias e da subclasse sem pés, DC, inglês ou "teste de resistência"', () => {
  const texto = JSON.stringify([novas, lamina]);
  assert.ok(!/\b(pés|feet|ft|DC)\b/.test(texto), 'unidade/termo imperial');
  assert.ok(!/teste de resistência/i.test(texto), 'o site usa "salvaguarda"');
  assert.ok(!/\b(Bonus Action|Reaction|Hit Points|damage|saving throw)\b/.test(texto), 'inglês remanescente');
  assert.ok(!/\b\d+m\b/.test(texto), 'metros escritos por extenso ("9 metros"), como no site');
});

test('lista adicional: 23 magias do livro, todas resolvem no catálogo', () => {
  assert.equal(adicionais.classe, 'Mago');
  assert.equal(adicionais.magias.length, 23);
  const nomes = new Set([...indice.map((m) => m.nome), ...novas.map((m) => m.nome)]);
  for (const m of adicionais.magias) assert.ok(nomes.has(m.nome), `${m.nome} não existe no site`);
  const porNome = Object.fromEntries(adicionais.magias.map((m) => [m.nome, m]));
  assert.equal(porNome['Convocar Feérico'].nome_livro, 'Invocar Fada');
  assert.equal(porNome['Convocar Elemental'].nome_livro, 'Invocar Elemental');
  assert.equal(porNome['Invocar Constructo'].nome_livro, 'Invocar Construto');
  assert.equal(porNome['Invocar Ínfero'].nome_livro, 'Invocar Corruptor');
  assert.equal(porNome['Rompante de Espadas'].nome_livro, 'Rompante de Lâminas');
});

test('Lâmina Cantante: fonte registrada e características nos níveis do Mago 2024', () => {
  assert.ok(ler('dados/fontes.json').fontes.some((f) => f.id === lamina.fonte));
  assert.equal(lamina.nome_en, 'Bladesinger');
  assert.deepEqual(lamina.caracteristicas.map((c) => [c.nivel, c.nome]), [
    [3, 'Treinamento na Guerra e na Música'], [3, 'Canção da Lâmina'],
    [6, 'Ataque Extra'], [10, 'Canção da Defesa'], [14, 'Canção da Vitória'],
  ]);
});
