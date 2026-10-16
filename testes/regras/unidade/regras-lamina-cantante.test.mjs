// ============================================================
// Regras puras da Lâmina Cantante (Mago, Tasha's): usos, impedimentos,
// bônus mínimo +1, Canção da Defesa e Canção da Vitória.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const r = await import('../../../site/js/regras-lamina-cantante.js');
const { multiclasse } = await modulosApp();

/** Personagem com as classes dadas (a do Mago com subclasse), Int dada e inventário vazio. */
async function personagem(classes, { int = 16, inventario = [], condicoes = [] } = {}) {
  const p = await personagemMulticlasse(classes.map(({ classe, nivel }) => ({ classe, nivel })));
  p.classes = classes.map((c, i) => ({ classe: c.classe, subclasse: c.subclasse || '', nivel: c.nivel, ordem: i }));
  multiclasse.sincronizarEspelhos(p);
  p.atributos = { forca: 10, destreza: 14, constituicao: 12, inteligencia: int, sabedoria: 10, carisma: 10 };
  p.atributos_base = { ...p.atributos };
  p.inventario = inventario;
  p.condicoes = condicoes;
  p.recursos = {};
  return p;
}
const MAGO = (nivel) => [{ classe: 'Mago', subclasse: 'Lâmina Cantante', nivel }];
const ESCUDO = { nome: 'Escudo', tipo: 'armadura', equipado: true, dados: { categoria: 'Escudo', ca: '+2' } };
const COTA = { nome: 'Cota de Malha', tipo: 'armadura', equipado: true, dados: { categoria: 'Pesada', ca: '16' } };
const COURO = { nome: 'Armadura de Couro', tipo: 'armadura', equipado: true, dados: { categoria: 'Leve', ca: '11 + modificador de Des' } };

test('só Lâmina Cantante com Mago 3+', async () => {
  assert.equal(r.ehLaminaCantante(await personagem(MAGO(3))), true);
  assert.equal(r.ehLaminaCantante(await personagem([{ classe: 'Mago', subclasse: 'Abjurador', nivel: 5 }])), false);
});

test('usos = bônus de proficiência do nível total (multiclasse)', async () => {
  assert.equal(r.usosMaxCancao(await personagem(MAGO(3))), 2);
  const multi = await personagem([{ classe: 'Guerreiro', nivel: 5 }, { classe: 'Mago', subclasse: 'Lâmina Cantante', nivel: 4 }]);
  assert.equal(r.usosMaxCancao(multi), 4);
});

test('bônus = mod. Int com mínimo +1', async () => {
  assert.equal(r.bonusCancao(await personagem(MAGO(3), { int: 18 })), 4);
  assert.equal(r.bonusCancao(await personagem(MAGO(3), { int: 10 })), 1);
  assert.equal(r.bonusCancao(await personagem(MAGO(3), { int: 7 })), 1);
});

test('impedimentos: escudo, armadura Média/Pesada, Incapacitado; Leve não impede', async () => {
  assert.equal(r.impedimentoCancao(await personagem(MAGO(3), { inventario: [COURO] })), '');
  assert.match(r.impedimentoCancao(await personagem(MAGO(3), { inventario: [ESCUDO] })), /Escudo/);
  assert.match(r.impedimentoCancao(await personagem(MAGO(3), { inventario: [COTA] })), /armadura/i);
  assert.match(r.impedimentoCancao(await personagem(MAGO(3), { condicoes: ['Atordoado'] })), /Incapacitado/);
});

test('iniciar gasta um uso; sem usos recusa; encerrar desliga', async () => {
  const p = await personagem(MAGO(3));
  assert.deepEqual(r.iniciarCancao(p), { ok: true });
  assert.equal(r.cancaoAtiva(p), true);
  assert.equal(r.usosRestantesCancao(p), 1);
  r.encerrarCancao(p);
  assert.equal(r.cancaoAtiva(p), false);
  r.iniciarCancao(p); r.encerrarCancao(p);
  assert.equal(r.iniciarCancao(p).ok, false);
});

test('equipar escudo com a Canção ativa: cancaoAtiva cai e encerrarCancaoSeImpedida grava', async () => {
  const p = await personagem(MAGO(3));
  r.iniciarCancao(p);
  p.inventario.push(ESCUDO);
  assert.equal(r.cancaoAtiva(p), false);
  assert.equal(r.encerrarCancaoSeImpedida(p), true);
  p.inventario.pop();
  assert.equal(r.cancaoAtiva(p), false, 'tirar o escudo não religa a Canção');
});

test('descanso encerra e devolve os usos', async () => {
  const p = await personagem(MAGO(3));
  r.iniciarCancao(p);
  r.descansoCancao(p);
  assert.equal(r.cancaoAtiva(p), false);
  assert.equal(r.usosRestantesCancao(p), 2);
});

test('Canção da Defesa (10) e da Vitória (14)', async () => {
  assert.equal(r.reducaoCancaoDefesa(3), 15);
  const p9 = await personagem(MAGO(9)); r.iniciarCancao(p9);
  assert.equal(r.podeCancaoDefesa(p9), false);
  const p10 = await personagem(MAGO(10)); r.iniciarCancao(p10);
  assert.equal(r.podeCancaoDefesa(p10), true);
  assert.equal(r.bonusDanoCancaoVitoria(p10), 0);
  const p14 = await personagem(MAGO(14), { int: 18 }); r.iniciarCancao(p14);
  assert.equal(r.bonusDanoCancaoVitoria(p14), 4);
});
