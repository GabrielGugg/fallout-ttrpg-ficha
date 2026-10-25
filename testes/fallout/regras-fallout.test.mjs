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

test('fome, sede, fadiga, exaustão e rads reduzem as perícias', () => {
  const c = base({ special: { ...R.specialInicial(), AGI: 7 }, fome: 1, desidratacao: 2, exaustao: 1, fadiga: 1, radiacao: 1 });
  assert.equal(R.penalidadeD20(c), 6);
  assert.equal(R.bonusPericia(c, 'disparo'), 2 - 6);
  const robo = { ...c, raca: 'robo' };
  assert.equal(R.penalidadeD20(robo), 2); // só fadiga e exaustão
  assert.deepEqual(R.contadoresDaRaca(robo).map(x => x.id), ['fadiga', 'exaustao']);
  assert.ok(!R.contadoresDaRaca({ raca: 'necrotico' }).some(x => x.id === 'radiacao'));
});

test('munição: pente, reserva e recarga', () => {
  const pistola = { campos: { 'Munição e Recarga': '10mm, 12 balas' } };
  const laser = { campos: { 'Munição e Recarga': '1 Célula de Energia = 30 disparos' } };
  assert.deepEqual(R.municaoDaArma(pistola), { tipo: '10mm', capacidade: 12, porCarga: false });
  assert.deepEqual(R.municaoDaArma(laser), { tipo: 'Célula de Energia', capacidade: 30, porCarga: true });
  assert.equal(R.municaoDaArma({ campos: { 'Munição e Recarga': 'A arma pode disparar enquanto estiver sob a luz do sol.' } }), null);
  const cat = { m10: { nome: '10mm', categoria: 'Munição' }, p10: { nome: 'Pistola 10mm', categoria: 'Tabelas de Armas à Distância' } };
  const inv = [{ ref: 'p10', nome: 'Pistola 10mm', qtd: 1 }, { ref: 'm10', nome: '10mm', qtd: 10 }, { ref: null, nome: 'Munição 10mm', qtd: 5 }];
  assert.equal(R.municaoNoInventario(inv, cat, '10mm'), 15);
  assert.deepEqual(R.recarregar(R.municaoDaArma(pistola), 4, 15), { pente: 12, gasto: 8 });
  assert.deepEqual(R.recarregar(R.municaoDaArma(pistola), 4, 3), { pente: 7, gasto: 3 });
  assert.deepEqual(R.recarregar(R.municaoDaArma(laser), 2, 1), { pente: 30, gasto: 1 });
});

// ---------------------------------------------------------------- v0.3: carga e inventário
// (Itens e Custo, Talentos, Traços, Fabricação > Desgaste e Reparos)

const CAT = {
  armaduras_tecido: { id: 'armaduras_tecido', nome: 'Tecido', categoria: 'Armaduras', subcategoria: '', campos: { DF: '10', TD: '0', 'Espaços': '8', 'Carga e Req. de FOR': 'Carga 5, FOR 1' } },
  armaduras_aco: { id: 'armaduras_aco', nome: 'Aço', categoria: 'Armaduras', subcategoria: '', campos: { DF: '13', TD: '2', 'Espaços': '2', 'Carga e Req. de FOR': 'Carga 50, FOR 6' } },
  itens_unicos_traje_de_refugio: { id: 'itens_unicos_traje_de_refugio', nome: 'Traje de Refúgio', categoria: 'Itens Únicos', subcategoria: '', campos: { Carga: '5' } },
  itens_e_equipamentos_mochila: { id: 'itens_e_equipamentos_mochila', nome: 'Mochila', categoria: 'Itens e Equipamentos', subcategoria: '', campos: { Carga: '10 quando não vestida' } },
  itens_e_equipamentos_mochila_de_acampamento: { id: 'itens_e_equipamentos_mochila_de_acampamento', nome: 'Mochila de Acampamento', categoria: 'Itens e Equipamentos', subcategoria: '', campos: { Carga: '20 quando não vestida' } },
  itens_e_equipamentos_bandoleira: { id: 'itens_e_equipamentos_bandoleira', nome: 'Bandoleira', categoria: 'Itens e Equipamentos', subcategoria: '', campos: { Carga: '8 quando não vestida' } },
  itens_e_equipamentos_mascara_de_gas: { id: 'itens_e_equipamentos_mascara_de_gas', nome: 'Máscara de Gás', categoria: 'Itens e Equipamentos', subcategoria: '', campos: { Carga: '12' } },
  itens_e_equipamentos_roupa_termica: { id: 'itens_e_equipamentos_roupa_termica', nome: 'Roupa Térmica', categoria: 'Itens e Equipamentos', subcategoria: '', campos: { Carga: '20 (igual a 5 quando vestida)' } },
  pistola: { id: 'pistola', nome: 'Pistola', categoria: 'Tabelas de Armas à Distância', subcategoria: 'Armas de Mão', campos: { PA: '4 PA', 'Carga e Req. de FOR': 'Carga 3, FOR 2' } },
  mira: { id: 'mira', nome: 'Mira Holográfica', categoria: 'Modificações de Armas à Distância', subcategoria: '', campos: { 'Descrição': '**Espaços: 2.** ...' } },
  leve: { id: 'leve', nome: 'Construção Leve', categoria: 'Modificações de Armas à Distância', subcategoria: '', campos: { 'Descrição': '**Espaços: 2.** ...' } },
  gazua: { id: 'gazua', nome: 'Gazua', categoria: 'Itens e Equipamentos', subcategoria: '', campos: { Carga: '2' } },
};

test('carga máxima: Força, traço e talento Acumulador, Rato de Carga, Dotado', () => {
  const c = base(); // FOR 5
  assert.equal(R.capacidadeDeCarga(c, CAT), 50);
  const tr = id => ({ tracos: { personagem: [{ id }] } });
  assert.equal(R.capacidadeDeCarga(base(tr('acumulador')), CAT), 75);
  assert.equal(R.capacidadeDeCarga(base({ tracos: { personagem: [{ id: 'acumulador', ermo: true }] } }), CAT), 50);
  assert.equal(R.capacidadeDeCarga(base(tr('dotado')), CAT), 60);
  const tal = (...ids) => ({ nivel: 4, progressao: ids.map((t, i) => ({ nivel: i + 1, tipo: 'talento', talento: t })) });
  assert.equal(R.capacidadeDeCarga(base(tal('acumulador')), CAT), 100);
  assert.equal(R.capacidadeDeCarga(base(tal('rato_de_carga', 'rato_de_carga')), CAT), 70);
  assert.equal(R.capacidadeDeCarga(base({ ajuste_carga: 10 }), CAT), 60);
});

test('bolsas vestidas: aumentam a capacidade e não pesam; duas bolsas sobrecarregam', () => {
  const inv = [{ ref: 'itens_e_equipamentos_mochila', qtd: 1, equipado: true }, { ref: 'itens_e_equipamentos_bandoleira', qtd: 1, equipado: true }];
  const c = base({ inventario: inv });
  assert.equal(R.capacidadeDeCarga(c, CAT), 125);
  assert.equal(R.cargaTotal(c, CAT), 0);
  assert.equal(R.cargaTotal(base({ inventario: inv.map(l => ({ ...l, equipado: false })) }), CAT), 18);
  const duas = base({ inventario: [...inv, { ref: 'itens_e_equipamentos_mochila_de_acampamento', qtd: 1, equipado: true }] });
  assert.equal(R.estadoDeCarga(duas, CAT).sobrecarregado, true);
  const forte = { ...duas, special: { ...R.specialInicial(), FOR: 8, PER: 2 } };
  assert.equal(R.estadoDeCarga(forte, CAT).sobrecarregado, false);
});

test('Rato de Carga: itens com carga menor que 3 valem 1', () => {
  const c = base({ nivel: 2, progressao: [{ nivel: 1, tipo: 'talento', talento: 'rato_de_carga' }], inventario: [{ ref: 'gazua', qtd: 3 }] });
  assert.equal(R.cargaTotal(c, CAT), 3);
});

test('Máscara de Gás, Roupa Térmica e Traje de Refúgio', () => {
  const c = base({ inventario: [{ ref: 'itens_e_equipamentos_mascara_de_gas', qtd: 1, equipado: true }] });
  assert.equal(R.sentidosPassivos(c, CAT), 10);
  assert.equal(R.limiarDeRadiacao(c, CAT), 9);
  const t = base({ special: { ...R.specialInicial(), AGI: 8, PER: 2 }, inventario: [{ ref: 'itens_e_equipamentos_roupa_termica', qtd: 1, equipado: true }] });
  assert.equal(R.pontosDeAcao(t, CAT), 12);
  assert.equal(R.cargaTotal(t, CAT), 5);
  const v = base({ inventario: [{ ref: 'itens_unicos_traje_de_refugio', qtd: 1, equipado: true }] });
  assert.deepEqual(R.defesas(v, CAT), { df: 10, td: 1, armadura: 'Traje de Refúgio' });
  assert.equal(R.limiarDeRadiacao(v, CAT), 10);
  assert.equal(R.cargaTotal(v, CAT), 2.5);
});

test('melhorias de armadura e desgaste', () => {
  const linha = { ref: 'armaduras_aco', qtd: 1, equipado: true, melhorias: [{ id: 'reforcada', nivel: 3 }, { id: 'cheia_de_bolsos', nivel: 2 }] };
  const c = base({ inventario: [linha] });
  assert.equal(R.defesas(c, CAT).td, 6);
  assert.equal(R.capacidadeDeCarga(c, CAT), 65);
  // Livro: armadura de aço com 4 níveis de desgaste -> DF 11, TD 0.
  const gasta = base({ inventario: [{ ref: 'armaduras_aco', qtd: 1, equipado: true, desgaste: 4 }] });
  assert.deepEqual([R.defesas(gasta, CAT).df, R.defesas(gasta, CAT).td], [11, 0]);
  const robusta = base({ inventario: [{ ref: 'armaduras_aco', qtd: 1, equipado: true, desgaste: 4, melhorias: [{ id: 'robusta', nivel: 1 }] }] });
  assert.equal(R.defesas(robusta, CAT).df, 12);
  const leve = R.estatisticasDaArmadura({ melhorias: [{ id: 'leve', nivel: 2 }] }, CAT.armaduras_aco, CAT);
  assert.deepEqual([leve.carga, leve.forca, leve.td], [40, 5, 1]);
});

test('modificações de arma: acerto, carga, Força e desgaste', () => {
  const c = base({ special: { ...R.specialInicial(), AGI: 7 } });
  const linha = { ref: 'pistola', mods: ['mira', 'leve'], desgaste: 2 };
  const est = R.estatisticasDaArma(linha, CAT.pistola, CAT);
  assert.equal(est.carga, 2.5); // 3 ÷ 2 + 1
  assert.equal(est.forca, 1);
  assert.equal(est.espacos.usados, 4);
  const a = R.calcularAtaque(c, CAT.pistola, null, linha, CAT);
  assert.equal(a.acerto, 2 + 1 - 2);
});

test('Robusto e Dotado', () => {
  const r = base({ nivel: 3, tracos: { personagem: [{ id: 'robusto' }] } });
  assert.equal(R.pvMaximo(r) - R.pvMaximo(base({ nivel: 3 })), 3);
  assert.equal(R.peMaximo(base({ nivel: 3 })) - R.peMaximo(r), 3);
  const d = base({ tracos: { personagem: [{ id: 'dotado' }] } });
  assert.equal(R.bonusPericia(d, 'barganha'), -3);
  assert.equal(R.tampasDeKarma(d), 2);
  assert.equal(R.iniciativa(d), 11);
});

test('pacote: nome limpo, desgaste e melhoria separados', () => {
  const itens = [
    { id: 'armaduras_tecido', nome: 'Tecido', categoria: 'Armaduras', subcategoria: '' },
    { id: 'melhorias_de_armadura_chumbada', nome: 'Chumbada', categoria: 'Armaduras', subcategoria: 'Melhorias de Armadura' },
    { id: 'sucata', nome: 'Pistola de Sucata' },
  ];
  const r = R.interpretarPacote('x1 armadura de tecido (com melhoria Chumbada nível 1), x1 pistola de sucata com dois Níveis de Desgaste.', itens);
  assert.deepEqual(r.linhas[0], { nome: 'Armadura de tecido', qtd: 1, ref: 'armaduras_tecido', desgaste: 0, melhorias: [{ id: 'chumbada', nivel: 1 }] });
  assert.deepEqual(r.linhas[1], { nome: 'Pistola de Sucata', qtd: 1, ref: 'sucata', desgaste: 2 });
});
