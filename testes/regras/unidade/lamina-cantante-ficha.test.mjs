// ============================================================
// Efeitos da Canção da Lâmina na ficha: CA, deslocamento, Vantagem em
// Acrobacia, dano corpo a corpo no 14 e Ataque Extra no 6.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { lerClassesDados, modulosApp, personagemMulticlasse } from './harness.mjs';

const { utils, sheetEstado, sheetCombate, multiclasse } = await modulosApp();
const sheetAtaqueCalculo = await import('../../../site/js/sheet/ataque-calculo.js');
const r = await import('../../../site/js/regras-lamina-cantante.js');

/** Mago Lâmina Cantante (Des 14, Int 16) carregado como char da ficha. */
async function mago(nivel, { inventario = [], int = 16 } = {}) {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel }]);
  p.classes = [{ classe: 'Mago', subclasse: 'Lâmina Cantante', nivel, ordem: 0 }];
  multiclasse.sincronizarEspelhos(p);
  p.atributos = { forca: 10, destreza: 14, constituicao: 12, inteligencia: int, sabedoria: 10, carisma: 10 };
  p.atributos_base = { ...p.atributos };
  p.inventario = inventario;
  p.condicoes = [];
  p.recursos = {};
  sheetEstado.definirChar(p);
  sheetEstado.definirPassivosTalentos(null);
  return p;
}
const metros = (txt) => parseFloat(String(txt).replace(',', '.'));
const RAPIEIRA = { id: 'r', nome: 'Rapieira', tipo: 'arma', quantidade: 1, equipado: true, dados: { categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Perfurante', propriedades: 'Acuidade' } };
const ARCO = { id: 'a', nome: 'Arco Curto', tipo: 'arma', quantidade: 1, equipado: true, dados: { categoria: 'Armas Simples à Distância', dano: '1d6 Perfurante', propriedades: 'Duas Mãos, Munição (Alcance 24/96; Flecha)' } };

test('CA soma o bônus só com a Canção ativa, sem acumular entre chamadas', async () => {
  const p = await mago(3);
  assert.equal(utils.calcCA(p), 12);
  r.iniciarCancao(p);
  assert.equal(utils.calcCA(p), 15);
  assert.equal(utils.calcCA(p), 15);
  r.encerrarCancao(p);
  assert.equal(utils.calcCA(p), 12);
});

test('deslocamento +3 m e Vantagem em Acrobacia com a Canção ativa', async () => {
  const p = await mago(3);
  const antes = metros(sheetCombate.getDeslocamentoFinal('9 metros'));
  assert.ok(!sheetCombate.calcVantagemDesvantagemPericia('Acrobacia').vantagens.includes('Canção da Lâmina'));
  r.iniciarCancao(p);
  assert.equal(metros(sheetCombate.getDeslocamentoFinal('9 metros')), antes + 3);
  assert.ok(sheetCombate.calcVantagemDesvantagemPericia('Acrobacia').vantagens.includes('Canção da Lâmina'));
  assert.ok(!sheetCombate.calcVantagemDesvantagemPericia('Atletismo').vantagens.includes('Canção da Lâmina'));
});

test('Ataque Extra no 6º nível de Mago Lâmina Cantante', async () => {
  await mago(5);
  assert.equal(sheetCombate.getAtaquesPorAcao(), 1);
  await mago(6);
  assert.equal(sheetCombate.getAtaquesPorAcao(), 2);
});

test('Canção da Vitória: + Int no dano corpo a corpo, nada à distância', async () => {
  const p = await mago(14, { inventario: [RAPIEIRA, ARCO], int: 18 });
  const sem = sheetAtaqueCalculo.calcularAtaqueItem(RAPIEIRA).danoExibicao;
  r.iniciarCancao(p);
  const com = sheetAtaqueCalculo.calcularAtaqueItem(RAPIEIRA).danoExibicao;
  assert.equal(sem, '1d8+2 Perfurante');
  assert.equal(com, '1d8+6 Perfurante');
  assert.equal(sheetAtaqueCalculo.calcularAtaqueItem(ARCO).danoExibicao, '1d6+2 Perfurante');
});

test('nível 13 com a Canção ativa: sem bônus de dano', async () => {
  const p = await mago(13, { inventario: [RAPIEIRA] });
  r.iniciarCancao(p);
  assert.equal(sheetAtaqueCalculo.calcularAtaqueItem(RAPIEIRA).danoExibicao, '1d8+2 Perfurante');
});

test('Canção da Defesa sem espaço livre: botão desabilitado', async () => {
  const p = await mago(10);
  r.iniciarCancao(p);
  sheetEstado.definirClassesData(new Map([['Mago', lerClassesDados().get('Mago')]]));
  const { renderSecaoLaminaCantante } = await import('../../../site/js/sheet/lamina-cantante.js');
  // Controle positivo: com espaços livres o botão fica habilitado.
  p.espacos_magia = { conjuracao: {}, pacto: {} };
  sheetEstado.definirChar(p);
  const livre = renderSecaoLaminaCantante();
  assert.match(livre, /data-cancao-acao="defesa" >/);
  assert.doesNotMatch(livre, /data-cancao-acao="defesa" disabled/);
  p.espacos_magia = { conjuracao: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, pacto: {} };
  sheetEstado.definirChar(p);
  assert.match(renderSecaoLaminaCantante(), /data-cancao-acao="defesa" disabled/);
});
