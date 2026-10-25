// Testes das regras puras do Fallout 2.1, conferidas com as notas traduzidas
// (Criação de Personagem, Subindo de Nível, Atributos e Perícias, Raças).
// Rodar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../site/js/regras-fallout.js';

const base = (extra = {}) => ({ raca: 'humano', nivel: 1, special: R.specialInicial(), ...extra });

test('modificador é valor − 5', () => {
  assert.equal(R.modificador(1), -4);
  assert.equal(R.modificador(5), 0);
  assert.equal(R.modificador(10), 5);
});

test('distribuição inicial: 3 pontos, baixar devolve pontos', () => {
  const s = R.specialInicial();
  assert.equal(R.pontosSpecialRestantes(s), 3);
  s.FOR = 8;
  assert.deepEqual(R.validarSpecialInicial(s), []);
  s.SOR = 3; s.AGI = 7;
  assert.deepEqual(R.validarSpecialInicial(s), []);
  s.CAR = 11;
  assert.ok(R.validarSpecialInicial(s).length > 0);
});

test('PV e PE seguem a Tabela de Evolução', () => {
  const c = base({ special: { ...R.specialInicial(), RES: 7, AGI: 6 } });
  assert.equal(R.pvMaximo(c), 12);          // 10 + 2
  assert.equal(R.peMaximo(c), 11);          // 10 + 1
  c.nivel = 2; assert.equal(R.pvMaximo(c), 12);
  c.nivel = 3; assert.equal(R.pvMaximo(c), 19);  // 15 + 2×2
  c.nivel = 5; assert.equal(R.pvMaximo(c), 26);  // 20 + 2×3
  c.nivel = 30; assert.equal(R.peMaximo(c), 95); // 80 + 1×15
});

test('Pontos de Ação: 10 + AGI, no máximo 15', () => {
  assert.equal(R.pontosDeAcao(base({ special: { ...R.specialInicial(), AGI: 8 } })), 13);
  assert.equal(R.pontosDeAcao(base({ special: { ...R.specialInicial(), AGI: 10 }, progressao: [] })), 15);
});

test('perícia: atributo + metade da Sorte (para baixo) + antecedente', () => {
  const c = base({ special: { ...R.specialInicial(), AGI: 7, SOR: 8 } });
  const doutor = { pericias: ['sabotagem', 'medicina', 'ciencia'] };
  assert.equal(R.bonusPericia(c, 'disparo', doutor), 2 + 1);
  assert.equal(R.bonusPericia(c, 'medicina', doutor), 0 + 1 + 2);
  c.special.SOR = 4; // mod −1 -> metade arredondada para baixo = −1
  assert.equal(R.bonusPericia(c, 'disparo', doutor), 2 - 1);
});

test('perícia com atributo à escolha', () => {
  const c = base({ special: { ...R.specialInicial(), FOR: 3, CAR: 8 } });
  assert.equal(R.bonusPericia(c, 'intimidacao'), -2);
  c.atributo_pericia = { intimidacao: 'CAR' };
  assert.equal(R.bonusPericia(c, 'intimidacao'), 3);
});

test('Pontos de Talento: todo nível exceto 5, 9, 13, 17 e 19', () => {
  assert.equal(R.pontosDeTalento(base({ nivel: 1 })), 1);
  assert.equal(R.pontosDeTalento(base({ nivel: 3 })), 3);
  assert.equal(R.pontosDeTalento(base({ nivel: 5 })), 4);
  assert.equal(R.pontosDeTalento(base({ nivel: 20 })), 15);
  assert.equal(R.pontosDeTalento(base({ nivel: 30 })), 25);
});

test('Pontos de Perícia pela Inteligência', () => {
  const c = base({ nivel: 9, special: { ...R.specialInicial(), INT: 6 } });
  assert.equal(R.pontosDePericiaTotais(c), 10);
  c.special.INT = 4; assert.equal(R.pontosDePericiaTotais(c), 6);
  c.nivel = 3; assert.equal(R.pontosDePericiaTotais(c), 0);
});

test('derivados do 1º nível', () => {
  const c = base({ special: { FOR: 6, PER: 7, RES: 6, CAR: 5, INT: 5, AGI: 4, SOR: 5 } });
  assert.equal(R.fatorDeCura(c), 3);           // (1 + 6) / 2
  assert.equal(R.capacidadeDeCarga(c), 60);
  assert.equal(R.sentidosPassivos(c), 14);
  assert.equal(R.limiarDeRadiacao(c), 11);
  assert.equal(R.limiarDeRadiacao({ ...c, raca: 'necrotico' }), null);
  assert.equal(R.falhasParaMorrer(c), 4);
});

test('Super Mutante: Força +1, mínimo 6, carga +40', () => {
  const c = base({ raca: 'super_mutante', special: { ...R.specialInicial(), FOR: 3 } });
  assert.equal(R.atributosEfetivos(c).FOR, 6);
  assert.equal(R.capacidadeDeCarga(c), 100);
  c.variantes = ['Cepa Defeituosa']; c.special.FOR = 5; c.special.INT = 7;
  const v = R.atributosEfetivos(c);
  assert.equal(v.FOR, 7); assert.equal(v.RES, 7); assert.equal(v.INT, 3);
});

test('Talento comprado como atributo soma no SPECIAL', () => {
  const c = base({ nivel: 2, progressao: [{ nivel: 2, tipo: 'atributo', atributo: 'PER' }] });
  assert.equal(R.atributosEfetivos(c).PER, 6);
});

test('Defesa e TD: armadura, Guardatron e Peças Baratas', () => {
  const cat = { couro: { categoria: 'Armaduras', subcategoria: '', campos: { DF: '11', TD: '1', 'Carga e Req. de FOR': 'Carga 15, FOR 1' } } };
  const c = base({ inventario: [{ ref: 'couro', qtd: 1, equipado: true }] });
  assert.deepEqual(R.defesas(c, cat), { df: 11, td: 1, armadura: null });
  const robo = { ...c, raca: 'robo', subtipo: 'guardatron', tracos: { personagem: [{ id: 'pecas_baratas' }] } };
  const d = R.defesas(robo, cat);
  assert.equal(d.df, 10); assert.equal(d.td, 2);
  assert.equal(R.cargaTotal(c, cat), 7.5);
});

test('ataque: perícia, dano + mod, alcance × PER, desvantagem por Força', () => {
  const pistola = { subcategoria: 'Armas de Mão', campos: { Dano: '1d6', Alcance: 'x4/x10', 'Carga e Req. de FOR': 'Carga 3, FOR 7' } };
  const c = base({ special: { ...R.specialInicial(), AGI: 7, PER: 6 } });
  const a = R.calcularAtaque(c, pistola);
  assert.equal(a.pericia, 'disparo');
  assert.equal(a.acerto, 2);
  assert.equal(a.bonusDano, 2);
  assert.deepEqual(a.alcance, { normal: 24, longo: 60 });
  assert.equal(a.desvantagemForca, true);
});

test('requisitos de talento', () => {
  const c = base({ special: { ...R.specialInicial(), FOR: 4 } });
  assert.equal(R.cumpreRequisitos(c, { atributos: { FOR: 5 } }).ok, false);
  assert.equal(R.cumpreRequisitos(c, { atributos: { FOR: 4 } }).ok, true);
  assert.equal(R.cumpreRequisitos(c, { racas: ['robo'] }).ok, false);
  const s = base({ raca: 'sintetico', variantes: ['Atualizações de Software e Hardware'] });
  assert.equal(R.cumpreRequisitos(s, { racas: ['robo'] }).ok, true);
  assert.equal(R.cumpreRequisitos(c, { nivel: 3 }).ok, false);
});

test('XP: 1000 por nível', () => {
  assert.equal(R.nivelPorXp(0), 1);
  assert.equal(R.nivelPorXp(2999), 3);
  assert.equal(R.xpDoNivel(3), 2000);
});

test('pacote de equipamento vira inventário ligado ao catálogo', () => {
  const itens = [
    { id: 'faca', nome: 'Faca' }, { id: 'tecido', nome: 'Tecido' }, { id: 'stim', nome: 'Stimpak' },
    { id: 'mochila', nome: 'Mochila' },
  ];
  const r = R.interpretarPacote('x1 armadura de tecido, x1 faca com quatro Níveis de Desgaste, x2 Stimpaks, x1 mochila e x50 tampinhas.', itens);
  assert.equal(r.tampinhas, 50);
  assert.deepEqual(r.linhas.map(l => [l.qtd, l.ref, l.desgaste]), [[1, 'tecido', 0], [1, 'faca', 4], [2, 'stim', 0], [1, 'mochila', 0]]);
});

test('ferramenta de robô vira ataque', () => {
  const c = base({ raca: 'robo', subtipo: 'guardatron', special: { ...R.specialInicial(), FOR: 7 } });
  const a = R.ataqueDaFerramenta(c, 'Taser', 'Arma Corpo a Corpo. 4 Pontos de Ação. 2d8 de eletricidade. Acerto Crítico: 20, x2, aplica atordoado. Propriedades Especiais: Durável.');
  assert.equal(a.pa, '4 PA'); assert.equal(a.dano, '2d8 de eletricidade'); assert.equal(a.bonusDano, 2);
});

test('Ordem do Dano: estamina, TD, vida', () => {
  let r = R.aplicarDano({ pe: 5, pv: 10 }, 3, { td: 2 });
  assert.deepEqual([r.pe, r.pv], [2, 10]);
  r = R.aplicarDano({ pe: 2, pv: 10, pe_temp: 1 }, 8, { td: 2 }); // 1 temp, 2 PE, 5 -> TD 2 -> 3 PV
  assert.deepEqual([r.pe_temp, r.pe, r.pv], [0, 0, 7]);
  r = R.aplicarDano({ pe: 0, pv: 10 }, 9, { resistente: true, td: 1 }); // 9/2=4 -1 = 3
  assert.equal(r.pv, 7);
  r = R.aplicarDano({ pe: 10, pv: 4 }, 3, { direto: true });
  assert.deepEqual([r.pe, r.pv], [10, 1]);
  r = R.aplicarDano({ pe: 0, pv: 4 }, 20);
  assert.equal(r.pv, 0); assert.equal(r.chegouAZero, true); assert.equal(r.sobra, 16);
});

test('descanso: orgânico e máquina', () => {
  const c = base({ special: { ...R.specialInicial(), RES: 7, AGI: 7 }, pv_atual: 2, pe_atual: 0, exaustao: 2 });
  assert.equal(R.efeitoDescanso(c, 'curto').pe_atual, 6);           // metade de 12
  const longo = R.efeitoDescanso(c, 'longo');
  assert.deepEqual([longo.pv_atual, longo.pe_atual, longo.exaustao], [6, 12, 1]); // FC (1+7)/2 = 4
  const robo = { ...c, raca: 'robo', special: { ...c.special, INT: 9 } };
  assert.equal(R.efeitoDescanso(robo, 'curto').pe_atual, 12);
  assert.equal(R.efeitoDescanso(robo, 'longo').pv_atual, 7);         // (1+9)/2 = 5
});
