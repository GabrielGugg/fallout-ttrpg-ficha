// ============================================================
// Regras puras do Fallout TTRPG 2.1 (sem DOM, sem estado global)
// Toda função recebe o personagem (ou os valores) por parâmetro, o que
// permite testá-las no Node (testes/fallout/).
// ============================================================

/** S.P.E.C.I.A.L., na ordem do livro (letra = a sigla original em inglês). */
export const ATRIBUTOS = [
  { id: 'FOR', nome: 'Força', letra: 'S' },
  { id: 'PER', nome: 'Percepção', letra: 'P' },
  { id: 'RES', nome: 'Resistência', letra: 'E' },
  { id: 'CAR', nome: 'Carisma', letra: 'C' },
  { id: 'INT', nome: 'Inteligência', letra: 'I' },
  { id: 'AGI', nome: 'Agilidade', letra: 'A' },
  { id: 'SOR', nome: 'Sorte', letra: 'L' },
];

/** Perícias (em ordem alfabética) e atributos possíveis; o primeiro é o padrão. */
export const PERICIAS = [
  { id: 'barganha', nome: 'Barganha', atributos: ['CAR'] },
  { id: 'ciencia', nome: 'Ciência', atributos: ['INT'] },
  { id: 'corpo_a_corpo', nome: 'Corpo a Corpo', atributos: ['FOR'] },
  { id: 'criacao', nome: 'Criação', atributos: ['INT'] },
  { id: 'disparo', nome: 'Disparo', atributos: ['AGI'] },
  { id: 'energia', nome: 'Energia', atributos: ['PER'] },
  { id: 'explosivos', nome: 'Explosivos', atributos: ['PER'] },
  { id: 'furtividade', nome: 'Furtividade', atributos: ['AGI'] },
  { id: 'intimidacao', nome: 'Intimidação', atributos: ['FOR', 'CAR'] },
  { id: 'medicina', nome: 'Medicina', atributos: ['PER', 'INT'] },
  { id: 'persuasao', nome: 'Persuasão', atributos: ['CAR'] },
  { id: 'pugilismo', nome: 'Pugilismo', atributos: ['FOR'] },
  { id: 'sabotagem', nome: 'Sabotagem', atributos: ['PER', 'INT'] },
  { id: 'sobrevivencia', nome: 'Sobrevivência', atributos: ['RES'] },
];

export const NIVEL_MAXIMO = 30;
export const XP_POR_NIVEL = 1000;
export const PONTOS_INICIAIS_SPECIAL = 3;
export const TAMPINHAS_SEM_EQUIPAMENTO = 850;

/** Níveis que NÃO dão Ponto de Talento. */
const NIVEIS_SEM_TALENTO = [5, 9, 13, 17, 19];
/** Níveis que dão Pontos de Perícia. */
const NIVEIS_COM_PERICIA = [5, 9, 13, 17, 21, 25, 29];

/** Subcategoria da tabela de armas -> perícia usada no ataque. */
const PERICIA_DA_ARMA = {
  'Armas Cortantes': 'corpo_a_corpo',
  'Armas Contundentes': 'corpo_a_corpo',
  'Armas Mecânicas': 'corpo_a_corpo',
  'Armas Desarmadas': 'pugilismo',
  'Armas de Mão': 'disparo',
  'Submetralhadoras': 'disparo',
  'Rifles': 'disparo',
  'Escopetas': 'disparo',
  'Armas Pesadas': 'disparo',
  'Armas de Energia': 'energia',
  'Explosivos Arremessados': 'explosivos',
  'Explosivos Colocados': 'explosivos',
};

// ---------------------------------------------------------------- básicos

/** Modificador de atributo: valor − 5. */
export function modificador(valor) {
  return valor - 5;
}

/** Formata um número com sinal (+2, −1, +0). */
export function fmtSinal(n) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** Atalhos de leitura do personagem, sempre com valores padrão. */
const temVariante = (char, nome) => (char?.variantes || []).includes(nome);
const temTraco = (char, id) => (char?.tracos?.personagem || []).some(t => t.id === id);
const tracoErmo = (char, id) => (char?.tracos?.personagem || []).some(t => t.id === id && t.ermo);

/** Personagem com novo SPECIAL vazio (tudo 5). */
export function specialInicial() {
  return Object.fromEntries(ATRIBUTOS.map(a => [a.id, 5]));
}

/**
 * Pontos ainda livres na distribuição do 1º nível: começam em 3, cada ponto
 * acima de 5 gasta um, cada ponto abaixo de 5 devolve um.
 */
export function pontosSpecialRestantes(special) {
  const gasto = ATRIBUTOS.reduce((s, a) => s + ((special?.[a.id] ?? 5) - 5), 0);
  return PONTOS_INICIAIS_SPECIAL - gasto;
}

/** Valida a distribuição inicial: todos os pontos gastos e cada valor entre 1 e 10. */
export function validarSpecialInicial(special) {
  const erros = [];
  for (const a of ATRIBUTOS) {
    const v = special?.[a.id];
    if (!Number.isInteger(v) || v < 1 || v > 10) erros.push(`${a.nome} precisa ficar entre 1 e 10.`);
  }
  const resta = pontosSpecialRestantes(special);
  if (resta > 0) erros.push(`Ainda ${resta === 1 ? 'resta 1 ponto' : `restam ${resta} pontos`} para distribuir.`);
  if (resta < 0) erros.push(`Você gastou ${-resta} ${resta === -1 ? 'ponto' : 'pontos'} a mais. Diminua algum atributo.`);
  return erros;
}

// ---------------------------------------------------------------- atributos

/**
 * Aumentos de atributo comprados com Pontos de Talento, por atributo.
 * Vêm de `char.progressao` (uma entrada por nível) e de `char.aumentos_extra`.
 */
export function aumentosDeTalento(char) {
  const total = {};
  for (const p of char?.progressao || []) {
    if (p?.tipo === 'atributo' && p.atributo) total[p.atributo] = (total[p.atributo] || 0) + 1;
  }
  return total;
}

/**
 * Valor efetivo de cada atributo: distribuição inicial + Pontos de Talento +
 * ajustes de raça (Super Mutante e variantes). Fica entre 1 e 10, com os pisos
 * e tetos que a raça impõe.
 */
export function atributosEfetivos(char) {
  const base = { ...specialInicial(), ...(char?.special || {}) };
  const aumentos = aumentosDeTalento(char);
  const v = {};
  for (const a of ATRIBUTOS) v[a.id] = base[a.id] + (aumentos[a.id] || 0) + (char?.ajustes_atributo?.[a.id] || 0);

  const pisos = {};
  const tetos = {};
  if (char?.raca === 'super_mutante') {
    if (temVariante(char, 'Cepa Defeituosa')) {
      v.FOR += 2; v.RES += 2; v.INT -= 2;
      tetos.INT = 3;
    } else {
      // Força Superior e Noturno: +1 em Força, nunca abaixo de 6.
      v.FOR += 1;
      pisos.FOR = 6;
    }
  }
  for (const a of ATRIBUTOS) {
    let x = v[a.id];
    if (pisos[a.id] != null) x = Math.max(x, pisos[a.id]);
    if (tetos[a.id] != null) x = Math.min(x, tetos[a.id]);
    v[a.id] = Math.max(0, Math.min(10, x));
  }
  return v;
}

/** Modificadores de todos os atributos efetivos. */
export function modificadores(char) {
  const v = atributosEfetivos(char);
  return Object.fromEntries(ATRIBUTOS.map(a => [a.id, modificador(v[a.id])]));
}

// ---------------------------------------------------------------- perícias

/** Atributo que modifica a perícia (respeita a escolha do jogador quando a perícia permite). */
export function atributoDaPericia(char, idPericia) {
  const p = PERICIAS.find(x => x.id === idPericia);
  if (!p) return null;
  const escolhido = char?.atributo_pericia?.[idPericia];
  return p.atributos.includes(escolhido) ? escolhido : p.atributos[0];
}

/** Perícias que ganham +2 do antecedente (as três do antecedente, ou as escolhidas no Personalizado). */
export function periciasDoAntecedente(char, antecedente) {
  if (char?.pericias_antecedente?.length) return char.pericias_antecedente;
  return antecedente?.pericias || [];
}

/**
 * Bônus total de uma perícia, com a origem de cada parcela:
 * mod. do atributo + metade do mod. de Sorte (arredondado para baixo) +
 * 2 do antecedente + pontos de perícia + 2 de Muitas Estradas Percorridas.
 */
export function detalharPericia(char, idPericia, antecedente = null) {
  const mods = modificadores(char);
  const atributo = atributoDaPericia(char, idPericia);
  const partes = [
    { rotulo: `Mod. de ${atributo}`, valor: mods[atributo] },
    { rotulo: 'Metade do mod. de Sorte', valor: Math.floor(mods.SOR / 2) },
  ];
  if (periciasDoAntecedente(char, antecedente).includes(idPericia)) partes.push({ rotulo: 'Antecedente', valor: 2 });
  const pontos = char?.pontos_pericia?.[idPericia] || 0;
  if (pontos) partes.push({ rotulo: 'Pontos de perícia', valor: pontos });
  if (char?.raca === 'necrotico' && temVariante(char, 'Muitas Estradas Percorridas')) {
    partes.push({ rotulo: 'Muitas Estradas Percorridas', valor: 2 });
  }
  if (temTraco(char, 'dotado')) partes.push({ rotulo: 'Traço Dotado', valor: tracoErmo(char, 'dotado') ? -6 : -3 });
  const penal = penalidadeD20(char);
  if (penal) partes.push({ rotulo: 'Fome, sede, fadiga, exaustão e rads', valor: -penal });
  const extra = char?.bonus_pericia?.[idPericia] || 0;
  if (extra) partes.push({ rotulo: 'Ajuste manual', valor: extra });
  return { atributo, partes, total: partes.reduce((s, p) => s + p.valor, 0) };
}

/** Só o total do bônus de perícia. */
export function bonusPericia(char, idPericia, antecedente = null) {
  return detalharPericia(char, idPericia, antecedente).total;
}

// ---------------------------------------------------------------- sobrevivência

/**
 * Condições com níveis. `d20`: cada nível reduz em 1 os d20 (exceto Sorte);
 * `paMetade`: tira do PA máximo metade dos níveis; `paPorNivel`: tira 1 de PA
 * por nível. `limite`: o máximo possível; `morte`: chegar nele mata.
 */
export const CONTADORES_SOBREVIVENCIA = [
  { id: 'fome', nome: 'Fome', condicao: 'Fome', limite: 10, morte: true, d20: true },
  { id: 'desidratacao', nome: 'Desidratação', condicao: 'Desidratação', limite: 10, morte: true, d20: true },
  { id: 'fadiga', nome: 'Fadiga', condicao: 'Fadiga', limite: 9, morte: false, d20: true },
  { id: 'exaustao', nome: 'Exaustão', condicao: 'Exaustão', limite: 10, morte: true, d20: true },
  { id: 'radiacao', nome: 'Radiação', condicao: 'Radiação ou Rads', limite: 10, morte: true, d20: true },
  { id: 'hipotermia', nome: 'Hipotermia', condicao: 'Hipotermia', limite: 10, morte: true, d20: true, paMetade: true },
  { id: 'superaquecimento', nome: 'Superaquecimento', condicao: 'Superaquecimento', limite: 10, morte: true, d20: true, paMetade: true },
  { id: 'sangramento', nome: 'Sangramento', condicao: 'Sangramento', limite: 99, morte: false },
  { id: 'curto_circuito', nome: 'Curto-Circuito', condicao: 'Curto-Circuito', limite: 99, morte: false, paPorNivel: true },
];

/**
 * Contadores que se aplicam à raça: Sintético Gen 2 e Robô não comem, não
 * bebem, não ganham rads nem sangram; Necrótico e Super Mutante não ganham
 * rads; Curto-Circuito só aparece para Robô e Sintético.
 */
export function contadoresDaRaca(char) {
  const fora = new Set();
  const maquina = ['sintetico', 'robo'].includes(char?.raca);
  if (maquina) ['fome', 'desidratacao', 'radiacao', 'sangramento'].forEach(x => fora.add(x));
  else fora.add('curto_circuito');
  if (['necrotico', 'super_mutante'].includes(char?.raca)) fora.add('radiacao');
  return CONTADORES_SOBREVIVENCIA.filter(c => !fora.has(c.id));
}

/**
 * Efeitos das condições na ficha (Combate > Condições). Bêbado, Mamado e
 * Esbagaçado incluem os efeitos das anteriores, como o texto manda.
 * Devolve { pa, paTeto, pe, d20, desvantagem, notas: [{ nome, texto }] }.
 */
export function efeitosDeCondicoes(char, catalogo = null) {
  const tem = id => (char?.condicoes || []).includes(id);
  const nivel = char?.nivel || 1;
  const ef = { pa: 0, paTeto: null, pe: 0, d20: 0, notas: [] };
  const nota = (nome, texto) => ef.notas.push({ nome, texto });
  const esbagacado = tem('esbagacado');
  const mamado = tem('mamado') || esbagacado;
  const bebado = tem('bebado') || mamado;
  const leso = tem('leso') || bebado;
  if (tem('atordoado')) { ef.pa -= 3; nota('Atordoado', 'PA máximo −3; não pode reciclar PA.'); }
  if (bebado) { ef.pa -= 2; ef.pe += nivel; nota('Bêbado', `PA −2 e PE máximo +${nivel}.`); }
  if (mamado) { ef.pe += nivel; ef.d20 += 5; nota('Mamado', `PE máximo +${nivel} e −5 em todo d20 (exceto Sorte).`); }
  if (esbagacado) nota('Esbagaçado', 'Não lembra de nada do período e cai inconsciente depois de uma hora.');
  if (leso) nota('Léso', 'Desvantagem em testes de Inteligência e Percepção; vantagem em testes de Resistência e Força.');
  if (tem('envenenado')) nota('Envenenado', 'Desvantagem em todas as rolagens de d20.');
  if (tem('choque')) nota('Choque', 'Não recupera PE e tem desvantagem em todas as rolagens de d20.');
  if (tem('caido')) nota('Caído', 'Desvantagem nas rolagens de ataque; só rasteja.');
  if (tem('contido')) nota('Contido', 'Não se move; dano não pode sair dos PE.');
  if (tem('agarrado')) nota('Agarrado', 'Não pode gastar PA para se mover.');
  if (tem('cego')) nota('Cego', 'Falha em testes que exigem visão; ataques contra você têm vantagem.');
  if (tem('invisivel')) nota('Invisível', 'Ataques contra você têm desvantagem e os seus têm vantagem.');
  for (const c of contadoresDaRaca(char)) {
    const n = Math.max(0, char?.[c.id] || 0);
    if (!n) continue;
    if (c.paMetade && Math.floor(n / 2)) { ef.pa -= Math.floor(n / 2); nota(c.nome, `PA máximo −${Math.floor(n / 2)} (metade dos níveis).`); }
    if (c.paPorNivel) { ef.pa -= n; nota(c.nome, `PA máximo −${n}; 1d12 de dano de eletricidade por nível no início do turno.`); }
  }
  // Lento: pela condição ou por vestir armadura sem a Força pedida (o talento Acumulador evita).
  let lento = tem('lento');
  const arm = catalogo ? armaduraVestida(char?.inventario, catalogo) : null;
  if (!lento && arm && !talentosEscolhidos(char).includes('acumulador')) {
    const req = estatisticasDaArmadura(arm.linha, arm.item, catalogo).forca;
    if (req != null && atributosEfetivos(char).FOR < req) { lento = true; nota('Lento', `A armadura pede Força ${req}: começa o turno com no máximo 6 PA.`); }
  }
  if (lento) { ef.paTeto = 6; if (tem('lento')) nota('Lento', 'Começa o turno com no máximo 6 PA.'); }
  return ef;
}

/** Redutor total dos d20 (exceto Sorte) pelos níveis de sobrevivência e por Mamado. */
export function penalidadeD20(char) {
  const niveis = contadoresDaRaca(char).filter(c => c.d20).reduce((s, c) => s + Math.max(0, char?.[c.id] || 0), 0);
  return niveis + efeitosDeCondicoes(char).d20;
}

// ---------------------------------------------------------------- progressão

/** Nível alcançado com o XP dado (1000 por nível, teto 30). */
export function nivelPorXp(xp) {
  return Math.max(1, Math.min(NIVEL_MAXIMO, Math.floor((xp || 0) / XP_POR_NIVEL) + 1));
}

/** XP necessário para chegar ao nível. */
export function xpDoNivel(nivel) {
  return (nivel - 1) * XP_POR_NIVEL;
}

/** Quantos níveis ímpares existem até o nível (inclusive): é o que multiplica o mod. em PV e PE. */
function niveisImpares(nivel) {
  return Math.ceil(nivel / 2);
}

/** Máximo da Tabela de Evolução: 10 + 5 a cada nível ímpar após o 1º, + mod × níveis ímpares. */
function maximoTabela(nivel, mod) {
  const n = niveisImpares(nivel);
  return 10 + 5 * (n - 1) + mod * n;
}

/** Pontos de Vida máximos (Resistência), recalculados como se o mod. fosse o atual desde o 1º nível. */
export function pvMaximo(char) {
  const nivel = char?.nivel || 1;
  let pv = maximoTabela(nivel, modificadores(char).RES) + (char?.ajuste_pv || 0);
  if (temTraco(char, 'robusto')) pv += tracoErmo(char, 'robusto') ? 2 * nivel : nivel;
  return Math.max(1, pv);
}

/**
 * Pontos de Estamina máximos (Agilidade), com a mesma regra retroativa;
 * Robusto tira o nível (o dobro no Ermo Selvagem) e a melhoria Justa nível 2
 * da armadura vestida soma o nível.
 */
export function peMaximo(char, catalogo = null) {
  const nivel = char?.nivel || 1;
  let pe = maximoTabela(nivel, modificadores(char).AGI) + (char?.ajuste_pe || 0);
  if (temTraco(char, 'robusto')) pe -= tracoErmo(char, 'robusto') ? 2 * nivel : nivel;
  const arm = catalogo ? armaduraVestida(char?.inventario, catalogo) : null;
  if (arm && nivelMelhoria(arm, 'justa') >= 2) pe += nivel;
  pe += efeitosDeCondicoes(char, catalogo).pe;
  return Math.max(0, pe);
}

/**
 * Pontos de Ação: 10 + mod. de Agilidade, no máximo 15. Roupa Térmica e a
 * melhoria Isolamento nível 1 tiram 1, até o mínimo de 6.
 */
export function pontosDeAcao(char, catalogo = null) {
  let pa = Math.min(15, 10 + modificadores(char).AGI);
  let reducao = vestidos(char, catalogo).reduce((s, v) => s + (v.efeito.pa || 0), 0);
  const arm = catalogo ? armaduraVestida(char?.inventario, catalogo) : null;
  if (arm && nivelMelhoria(arm, 'isolamento') === 1) reducao -= 1;
  if (reducao) pa = Math.max(Math.min(pa, 6), pa + reducao);
  const cond = efeitosDeCondicoes(char, catalogo);
  pa += cond.pa;
  if (cond.paTeto != null) pa = Math.min(pa, cond.paTeto);
  return Math.max(0, pa);
}

/** Ponto de Talento ganho em um nível específico (todos, exceto 5, 9, 13, 17 e 19). */
export function ganhaTalentoNoNivel(nivel) {
  return !NIVEIS_SEM_TALENTO.includes(nivel);
}

/** Total de Pontos de Talento até o nível (+1 no 1º nível para Muitas Estradas Percorridas). */
export function pontosDeTalento(char) {
  const nivel = char?.nivel || 1;
  let total = 0;
  for (let n = 1; n <= nivel; n++) if (ganhaTalentoNoNivel(n)) total++;
  if (char?.raca === 'necrotico' && temVariante(char, 'Muitas Estradas Percorridas')) total++;
  return total;
}

/** Pontos de perícia por concessão, pelo valor de Inteligência (+1 para Algoritmos de IA). */
export function periciaPorConcessao(char) {
  const int = atributosEfetivos(char).INT;
  let n = int <= 4 ? 3 : int === 5 ? 4 : 5;
  if (char?.raca === 'sintetico' && temVariante(char, 'Algoritmos de Inteligência Artificial')) n++;
  return n;
}

/** Total de Pontos de Perícia disponíveis no nível (retroativo à Inteligência atual). */
export function pontosDePericiaTotais(char) {
  const nivel = char?.nivel || 1;
  const concessoes = NIVEIS_COM_PERICIA.filter(n => n <= nivel).length;
  return concessoes * periciaPorConcessao(char);
}

/** Pontos de perícia já distribuídos. */
export function pontosDePericiaGastos(char) {
  return Object.values(char?.pontos_pericia || {}).reduce((s, v) => s + (v || 0), 0);
}

// ---------------------------------------------------------------- derivados

/** Fator de Cura: (nível + Resistência) ÷ 2, arredondado para baixo, + traços. */
export function fatorDeCura(char) {
  const nivel = char?.nivel || 1;
  let fc = Math.floor((nivel + atributosEfetivos(char).RES) / 2);
  for (const id of ['metabolismo_rapido', 'pecas_baratas']) {
    if (temTraco(char, id)) fc += tracoErmo(char, id) ? nivel : 2;
  }
  return fc;
}

/** Sentidos Passivos: 12 + mod. de Percepção (− 2 com Máscara de Gás vestida). */
export function sentidosPassivos(char, catalogo = null) {
  let sp = 12 + modificadores(char).PER;
  for (const v of vestidos(char, catalogo)) sp += v.efeito.sentidos || 0;
  return sp;
}

/**
 * Limiar de Radiação (só Humano): 12 − mod. de Resistência (+3 com Metabolismo
 * Rápido), menos o que a máscara, os trajes e a melhoria Chumbada tiram.
 */
export function limiarDeRadiacao(char, catalogo = null) {
  if (char?.raca !== 'humano') return null;
  let lr = 12 - modificadores(char).RES;
  if (temTraco(char, 'metabolismo_rapido') && !tracoErmo(char, 'metabolismo_rapido')) lr += 3;
  for (const v of vestidos(char, catalogo)) lr += v.efeito.lr || 0;
  const arm = armaduraVestida(char?.inventario, catalogo);
  if (arm) lr -= 2 * nivelMelhoria(arm, 'chumbada');
  return lr;
}

/** Tampas de Karma: 1, +1 com Sorte 10, +1 com Engenhoso (Humano variante), +1/+2 com Dotado. */
export function tampasDeKarma(char) {
  let n = 1;
  if (atributosEfetivos(char).SOR >= 10) n++;
  if (char?.raca === 'humano' && temVariante(char, 'Engenhoso')) n++;
  if (temTraco(char, 'dotado')) n += tracoErmo(char, 'dotado') ? 2 : 1;
  return n;
}

/** Iniciativa passiva: 10 + mod. de Percepção (+1/+2 com Dotado). */
export function iniciativa(char) {
  let ini = 10 + modificadores(char).PER;
  if (temTraco(char, 'dotado')) ini += tracoErmo(char, 'dotado') ? 2 : 1;
  return ini;
}

/** Quantos Suspiros Finais falhos matam: 4 para Humano (Tenacidade), 3 para os demais. */
export function falhasParaMorrer(char) {
  return char?.raca === 'humano' ? 4 : 3;
}

/** Lê um número de um texto ("Carga 5, FOR 1" -> carga 5, FOR 1). */
function numeroApos(texto, rotulo) {
  const m = String(texto || '').match(new RegExp(rotulo + '\\s*(\\d+(?:[.,]\\d+)?)', 'i'));
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Requisito de Força de um item do catálogo (null se não tiver). */
export function requisitoForca(item) {
  const campo = Object.entries(item?.campos || {}).find(([k]) => k.startsWith('Carga'));
  return campo ? numeroApos(campo[1], 'FOR') : null;
}

/**
 * Carga unitária de um item do catálogo. Em textos como "10 quando não vestida"
 * ou "1, 2 quando cheio" vale o primeiro número (a carga guardada/vazia).
 */
export function cargaDoItem(item) {
  const campo = Object.entries(item?.campos || {}).find(([k]) => k.startsWith('Carga'));
  if (!campo) return 0;
  const n = numeroApos(campo[1], 'Carga');
  if (n != null) return n;
  const m = String(campo[1]).match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : 0;
}

// ---------------------------------------------------------------- itens de vestir

/**
 * Itens que se vestem (fora as armaduras) e o que fazem enquanto vestidos.
 * carga: aumento da Capacidade de Carga. cargaVestido: carga do próprio item
 * vestido. bolsa: conta para a regra de mais de uma bolsa. lr, sentidos, td,
 * pa: ajustes. semArmadura: não se veste armadura junto.
 */
export const VESTIVEIS = {
  itens_e_equipamentos_mochila: { bolsa: true, carga: 50, cargaVestido: 0 },
  itens_e_equipamentos_mochila_de_acampamento: { bolsa: true, carga: 100, cargaVestido: 0 },
  itens_e_equipamentos_bolsa_de_armas: { bolsa: true, bolsaDeArmas: true, cargaVestido: 0 },
  itens_e_equipamentos_bandoleira: { carga: 25, cargaVestido: 0 },
  itens_e_equipamentos_mascara_de_gas: { lr: -3, sentidos: -2 },
  itens_e_equipamentos_traje_hazmat: { lr: -10, cargaVestido: 10, nota: 'Imune a dano de radiação; falhar no teste de radiação não aumenta o LR.' },
  itens_e_equipamentos_traje_hazmat_motorizado: { td: 3, cargaVestido: 5, semArmadura: true, nota: 'Não ganha níveis de radiação e é imune a dano de radiação (precisa de energia).' },
  itens_e_equipamentos_roupa_termica: { pa: -1, cargaVestido: 5, semArmadura: true, nota: 'Isolado contra hipotermia.' },
  itens_e_equipamentos_roupa_termica_leve: { cargaVestido: 2, semArmadura: true, nota: 'Isolado contra hipotermia.' },
  itens_unicos_pip_boy_2000: {},
  itens_unicos_pip_boy_2000_mark_vi: {},
  itens_unicos_pip_boy_3000: {},
  itens_unicos_pip_boy_3000_mark_iv: {},
};

/**
 * Armaduras que não estão na tabela de armaduras: funcionam como o tipo `base`
 * com as melhorias embutidas (que não ocupam espaço).
 */
export const ARMADURAS_ESPECIAIS = {
  itens_unicos_traje_de_refugio: {
    base: 'armaduras_tecido',
    melhorias: [{ id: 'chumbada', nivel: 1 }, { id: 'reforcada', nivel: 1 }, { id: 'justa', nivel: 1 }, { id: 'robusta', nivel: 1 }],
  },
};

const PREFIXO_MELHORIA = 'melhorias_de_armadura_';

/** O item é uma armadura (da tabela ou especial)? */
export function ehArmadura(item) {
  return !!item && ((item.categoria === 'Armaduras' && !item.subcategoria) || !!ARMADURAS_ESPECIAIS[item.id]);
}

/** Tipo de uso de um item: 'armadura', 'arma', 'vestivel' ou null. */
export function tipoEquipavel(item) {
  if (ehArmadura(item)) return 'armadura';
  if (periciaDaArma(item)) return 'arma';
  if (item && VESTIVEIS[item.id]) return 'vestivel';
  return null;
}

/** Itens de vestir (não armaduras) vestidos, com o efeito de cada um. */
function vestidos(char, catalogo) {
  if (!catalogo) return [];
  const r = [];
  for (const linha of char?.inventario || []) {
    const item = catalogo[linha.ref];
    if (linha.equipado && item && VESTIVEIS[item.id]) r.push({ linha, item, efeito: VESTIVEIS[item.id] });
  }
  return r;
}

/** Armadura vestida no inventário (a primeira marcada como equipada). */
export function armaduraVestida(inventario, catalogo) {
  for (const linha of inventario || []) {
    if (!linha.equipado) continue;
    const item = catalogo?.[linha.ref];
    if (ehArmadura(item)) return { linha, item };
  }
  return null;
}

/** Melhorias de uma armadura: as embutidas (Traje de Refúgio) + as instaladas. */
export function melhoriasDaArmadura(linha, item) {
  const embutidas = (ARMADURAS_ESPECIAIS[item?.id]?.melhorias || []).map(m => ({ ...m, embutida: true }));
  const instaladas = (linha?.melhorias || []).filter(m => m?.id && m.nivel > 0);
  return [...embutidas, ...instaladas];
}

/** Nível de uma melhoria na armadura vestida (0 se não tiver; a maior, se repetida). */
function nivelMelhoria(vestida, id) {
  return melhoriasDaArmadura(vestida.linha, vestida.item)
    .filter(m => m.id === id).reduce((n, m) => Math.max(n, Math.min(3, m.nivel)), 0);
}

/**
 * Espaços de melhoria da armadura. Os níveis não ocupam espaço; numa armadura
 * especial as melhorias embutidas ocupam os espaços do tipo base.
 */
export function espacosDaArmadura(linha, item, catalogo = null) {
  const esp = ARMADURAS_ESPECIAIS[item?.id];
  const total = esp
    ? Math.max(0, (Number(catalogo?.[esp.base]?.campos?.['Espaços']) || 0) - esp.melhorias.length)
    : Number(item?.campos?.['Espaços']) || 0;
  return { total, usados: (linha?.melhorias || []).length };
}

/** Id curto de uma melhoria do catálogo ("melhorias_de_armadura_leve" -> "leve"). */
export function idMelhoria(itemCatalogo) {
  return String(itemCatalogo?.id || '').replace(PREFIXO_MELHORIA, '');
}

/**
 * Estatísticas de uma armadura com melhorias e desgaste: DF e TD (o desgaste
 * tira metade dos níveis, arredondada para baixo, de cada; a Robusta ignora os
 * 2 ou 4 primeiros níveis), carga e requisito de Força (Leve).
 */
export function estatisticasDaArmadura(linha, item, catalogo = null) {
  const baseItem = ARMADURAS_ESPECIAIS[item?.id] ? catalogo?.[ARMADURAS_ESPECIAIS[item.id].base] : item;
  const vest = { linha, item };
  const nv = id => nivelMelhoria(vest, id);
  let df = Number(baseItem?.campos?.DF) || 10;
  let td = Number(baseItem?.campos?.TD) || 0;
  let carga = linha?.carga != null ? Number(linha.carga) : (ARMADURAS_ESPECIAIS[item?.id] ? cargaDoItem(item) : cargaDoItem(baseItem));
  let forca = requisitoForca(baseItem);

  td += [0, 1, 2, 4][nv('reforcada')];
  df += nv('endurecida');
  const leve = nv('leve');
  if (leve >= 1) { td -= 1; if (forca != null) forca = Math.max(0, forca - 1); }
  if (leve === 1) carga = Math.max(0, carga - 5);
  if (leve >= 2) carga = Math.max(3, carga - 10);

  const ignorado = [0, 2, 4, 4][nv('robusta')];
  const desgaste = Math.max(0, (linha?.desgaste || 0) - ignorado);
  const perda = Math.floor(desgaste / 2);
  df = Math.max(10, df - perda);
  td = Math.max(0, td - perda);
  return { df, td, carga, forca, perdaDesgaste: perda, quebrada: (linha?.desgaste || 0) >= 10 };
}

// ---------------------------------------------------------------- modificações de arma

/**
 * Efeitos automáticos das modificações de arma (o resto fica no texto):
 * acerto, carga (+), cargaMult (×), forca (requisito), pa (com piso/teto) e pente.
 */
const EFEITOS_MOD = {
  mira_holografica: { acerto: 1, carga: 1 },
  luneta_infravermelha: { acerto: 2, carga: 2 },
  mira_laser: { carga: 1, props: ['Certeiro'] },
  construcao_leve: { cargaMult: 0.5, forca: -1, props: ['Quebrável'] },
  cano_longo: { carga: 4 },
  freio_de_boca: { acerto: 1, forca: -1, carga: 2 },
  coronha: { acerto: 1, carga: 4 },
  silenciador: { carga: 2 },
  reforco_estrutural: { carga: 2, props: ['Robusto', 'Defensivo'] },
  luneta: { carga: 2 },
  receptor_endurecido: { carga: 2, props: ['Destrutivo', 'Poderoso'] },
  semiautomatica: { props: ['Semiautomática'] },
  acao_dupla: { pa: -1, paMin: 1 },
  carregador_ampliado: { pente: 3 },
  // corpo a corpo
  cc_construcao_leve: { cargaMult: 0.5, forca: -1, pa: -1, paMin: 3, props: ['Quebrável'] },
  cc_lamina_dupla: { cargaMult: 2, forca: 1, props: ['Defensivo', 'Duas Mãos'] },
  cc_pesada: { cargaMult: 1.5, forca: 1, pa: 1, paMax: 6, props: ['Pesado'] },
  cc_fortificada: { props: ['Durável'] },
  cc_afiada_serrilhada_ou_farpada: { props: ['Mutilar'] },
};

/** Propriedades que mudam como a arma ganha desgaste ou o que ele faz. */
const PROPS_DESGASTE = ['Robusto', 'Durável', 'Quebrável', 'Instável', 'Frágil'];

/** A propriedade aparece no texto de propriedades da arma? (aceita masculino e feminino) */
function temPropriedade(texto, nome) {
  const raiz = nome.replace(/[oa]$/, '');
  return new RegExp(`(?<![\\p{L}])${raiz}[oa]?(?![\\p{L}])`, 'iu').test(texto);
}

/**
 * Propriedades de desgaste da arma: as do catálogo mais as que as
 * modificações dão (Construção Leve -> Quebrável, Reforço Estrutural ->
 * Robusto, Fortificada -> Durável).
 */
export function propriedadesDeDesgaste(linha, item, catalogo = null) {
  const texto = String(item?.campos?.['Propriedades Especiais'] || item?.campos?.Propriedades || '');
  const props = new Set(PROPS_DESGASTE.filter(n => temPropriedade(texto, n)));
  for (const id of linha?.mods || []) {
    for (const p of EFEITOS_MOD[chaveMod(catalogo?.[id])]?.props || []) if (PROPS_DESGASTE.includes(p)) props.add(p);
  }
  return props;
}

/** A modificação é de arma corpo a corpo? */
function modCorpoACorpo(mod) {
  return mod?.subcategoria === 'Modificações de Armas Corpo a Corpo';
}

/** Chave de efeito de uma modificação do catálogo. */
function chaveMod(mod) {
  const nome = chaveNome(mod?.nome).replace(/ /g, '_');
  return modCorpoACorpo(mod) ? `cc_${nome}` : nome;
}

/** Espaços de modificação que a modificação ocupa ("**Espaços: 3.**"). */
export function espacosDaMod(mod) {
  if (modCorpoACorpo(mod)) return 1;
  const m = String(mod?.campos?.['Descrição'] || '').match(/Espaços:\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** Modificações que servem para a arma (corpo a corpo ou à distância). */
export function modsCompativeis(item, itens = []) {
  const pericia = periciaDaArma(item);
  if (!pericia || pericia === 'explosivos') return [];
  const cc = ['corpo_a_corpo', 'pugilismo'].includes(pericia);
  return itens.filter(i => cc ? modCorpoACorpo(i) : i.categoria === 'Modificações de Armas à Distância');
}

/** Limite de modificações: 1 em corpo a corpo, 6 espaços à distância. */
export function limiteDeMods(item) {
  const cc = ['corpo_a_corpo', 'pugilismo'].includes(periciaDaArma(item));
  return cc ? { tipo: 'quantidade', max: 1 } : { tipo: 'espacos', max: 6 };
}

/**
 * Estatísticas de uma arma com modificações e desgaste: carga, requisito de
 * Força, ajuste de PA, bônus de acerto (mods − desgaste), balas extras no pente
 * e espaços usados.
 */
export function estatisticasDaArma(linha, item, catalogo = null) {
  const mods = (linha?.mods || []).map(id => catalogo?.[id]).filter(Boolean);
  const efeitos = mods.map(m => EFEITOS_MOD[chaveMod(m)] || {});
  let carga = linha?.carga != null ? Number(linha.carga) : cargaDoItem(item);
  for (const e of efeitos) if (e.cargaMult) carga *= e.cargaMult;
  for (const e of efeitos) carga += e.carga || 0;
  let forca = requisitoForca(item);
  if (forca != null) forca = Math.max(0, forca + efeitos.reduce((s, e) => s + (e.forca || 0), 0));
  const paBase = Number(String(item?.campos?.PA || '').match(/\d+/)?.[0]) || null;
  let pa = paBase;
  if (pa != null) {
    for (const e of efeitos) {
      if (!e.pa) continue;
      pa += e.pa;
      if (e.paMin != null) pa = Math.max(e.paMin, pa);
      if (e.paMax != null) pa = Math.min(e.paMax, pa);
    }
  }
  const desgaste = linha?.desgaste || 0;
  const props = propriedadesDeDesgaste(linha, item, catalogo);
  // Robusto ignora os 2 primeiros níveis; Frágil quebra no primeiro.
  const desgastePenaliza = props.has('Robusto') ? Math.max(0, desgaste - 2) : desgaste;
  const bonusMods = efeitos.reduce((s, e) => s + (e.acerto || 0), 0);
  const limite = limiteDeMods(item);
  const usados = limite.tipo === 'quantidade' ? mods.length : mods.reduce((s, m) => s + espacosDaMod(m), 0);
  return {
    carga: Math.round(carga * 10) / 10,
    forca,
    pa,
    paBase,
    acerto: bonusMods - desgastePenaliza,
    bonusMods,
    desgaste: desgastePenaliza,
    propriedades: [...props],
    recargasPorDesgaste: props.has('Instável') ? 5 : RECARGAS_POR_DESGASTE,
    pente: efeitos.reduce((s, e) => s + (e.pente || 0), 0),
    mods,
    espacos: { ...limite, usados },
    excedeu: usados > limite.max,
    quebrada: desgaste >= 10 || (props.has('Frágil') && desgaste >= 1),
  };
}

// ---------------------------------------------------------------- carga

/** Quantas vezes o personagem pegou um talento. */
function vezesTalento(char, id) {
  return talentosEscolhidos(char).filter(t => t === id).length;
}

/**
 * Capacidade de Carga máxima com a origem de cada parcela: Força × 10, Super
 * Mutante, traços (Acumulador, Dotado), talentos (Acumulador, Rato de Carga),
 * bolsas e bandoleira vestidas, melhoria Cheia de Bolsos e bônus manual
 * (Rato de Carga de outro personagem, comida Substanciosa...).
 */
export function detalharCapacidade(char, catalogo = null) {
  const partes = [{ rotulo: `Força ${atributosEfetivos(char).FOR} × 10`, valor: atributosEfetivos(char).FOR * 10 }];
  if (char?.raca === 'super_mutante') partes.push({ rotulo: 'Super Mutante', valor: 40 });
  if (temTraco(char, 'acumulador') && !tracoErmo(char, 'acumulador')) partes.push({ rotulo: 'Traço Acumulador', valor: 25 });
  if (temTraco(char, 'dotado')) partes.push({ rotulo: 'Traço Dotado', valor: tracoErmo(char, 'dotado') ? 20 : 10 });
  if (vezesTalento(char, 'acumulador')) partes.push({ rotulo: 'Talento Acumulador', valor: 50 });
  const rato = Math.min(3, vezesTalento(char, 'rato_de_carga'));
  if (rato) partes.push({ rotulo: `Talento Rato de Carga${rato > 1 ? ` ×${rato}` : ''}`, valor: 10 * rato });
  for (const v of vestidos(char, catalogo)) {
    if (v.efeito.carga) partes.push({ rotulo: `${v.item.nome} (vestida)`, valor: v.efeito.carga });
  }
  const arm = catalogo ? armaduraVestida(char?.inventario, catalogo) : null;
  if (arm) {
    const bolsos = nivelMelhoria(arm, 'cheia_de_bolsos');
    if (bolsos) partes.push({ rotulo: `Cheia de Bolsos nível ${bolsos}`, valor: [0, 10, 15, 25][bolsos] });
  }
  const extra = Number(char?.ajuste_carga) || 0;
  if (extra) partes.push({ rotulo: 'Outros bônus', valor: extra });
  return { partes, total: Math.max(0, partes.reduce((s, p) => s + p.valor, 0)) };
}

/** Capacidade de Carga máxima (total de detalharCapacidade). */
export function capacidadeDeCarga(char, catalogo = null) {
  return detalharCapacidade(char, catalogo).total;
}

/** O personagem veste uma Bolsa de Armas? */
function vesteBolsaDeArmas(char, catalogo) {
  return vestidos(char, catalogo).some(v => v.efeito.bolsaDeArmas);
}

/** A arma pode ir na Bolsa de Armas (Duas Mãos ou Desajeitada)? */
export function cabeNaBolsaDeArmas(item) {
  const txt = Object.values(item?.campos || {}).join(' ');
  return !!periciaDaArma(item) && /Duas Mãos|Desajeitad/i.test(txt);
}

/**
 * Carga de uma linha do inventário (já multiplicada pela quantidade):
 * armadura vestida conta pela metade, itens de vestir usam a carga de vestido,
 * armas somam as modificações, a Bolsa de Armas divide por 2 e o Rato de
 * Carga faz itens com carga menor que 3 valerem 1.
 */
export function cargaDaLinha(char, linha, catalogo = null) {
  const item = catalogo?.[linha?.ref];
  let unit;
  if (ehArmadura(item)) {
    unit = estatisticasDaArmadura(linha, item, catalogo).carga;
    if (linha.equipado) unit /= 2;
  } else if (periciaDaArma(item)) {
    unit = estatisticasDaArma(linha, item, catalogo).carga;
    if (linha.na_bolsa && cabeNaBolsaDeArmas(item) && vesteBolsaDeArmas(char, catalogo)) unit /= 2;
  } else {
    unit = linha?.carga != null ? Number(linha.carga) : cargaDoItem(item);
    const v = item && VESTIVEIS[item.id];
    if (v && linha.equipado && v.cargaVestido != null) unit = v.cargaVestido;
  }
  if (vezesTalento(char, 'rato_de_carga') && unit > 1 && unit < 3) unit = 1;
  return unit * (linha?.qtd || 1);
}

/** Carga total do inventário. */
export function cargaTotal(char, catalogo) {
  const total = (char?.inventario || []).reduce((s, l) => s + cargaDaLinha(char, l, catalogo), 0);
  return Math.round(total * 10) / 10;
}

/**
 * Situação da carga: atual, máximo, parcelas, sobrecarregado (acima do máximo),
 * muito sobrecarregado (acima do dobro) e avisos de regras.
 */
export function estadoDeCarga(char, catalogo) {
  const atual = cargaTotal(char, catalogo);
  const { partes, total: maximo } = detalharCapacidade(char, catalogo);
  const avisos = [];
  const imune = temTraco(char, 'acumulador') && tracoErmo(char, 'acumulador');
  const attr = atributosEfetivos(char);
  const bolsas = vestidos(char, catalogo).filter(v => v.efeito.bolsa);
  let sobrecarregado = atual > maximo;
  if (bolsas.length > 1 && attr.FOR < 8 && attr.RES < 8) {
    sobrecarregado = true;
    avisos.push('Mais de uma bolsa vestida: você fica sobrecarregado (a menos que Força ou Resistência seja 8 ou mais).');
  }
  const muito = atual > maximo * 2;
  if (imune) {
    sobrecarregado = false;
    avisos.push('Acumulador (Ermo Selvagem): imune a sobrecarregado; ganha um nível de fadiga sempre que a carga atual fica abaixo do máximo.');
  } else if (temTraco(char, 'acumulador') && atual < 50) {
    avisos.push('Acumulador: desvantagem em testes de atributo, de perícia e ataques enquanto carregar menos de 50 de carga.');
  }
  if (vezesTalento(char, 'acumulador')) avisos.push('Talento Acumulador: objetos pesados não deixam você lento.');
  const arm = catalogo ? armaduraVestida(char?.inventario, catalogo) : null;
  const semArm = vestidos(char, catalogo).find(v => v.efeito.semArmadura);
  if (arm && semArm) avisos.push(`${semArm.item.nome}: não dá para vestir armadura junto.`);
  if (arm) {
    const est = estatisticasDaArmadura(arm.linha, arm.item, catalogo);
    if (est.forca != null && attr.FOR < est.forca && !vezesTalento(char, 'acumulador')) {
      avisos.push(`${arm.linha.nome || arm.item.nome} pede Força ${est.forca}: você fica lento.`);
    }
  }
  const naBolsa = (char?.inventario || []).filter(l => l.na_bolsa).reduce((s, l) => s + (l.qtd || 1), 0);
  if (naBolsa > 3) avisos.push('A Bolsa de Armas guarda no máximo três armas.');
  return {
    atual, maximo, partes, avisos,
    sobrecarregado: sobrecarregado && !imune,
    muitoSobrecarregado: muito && !imune,
  };
}

/** Efeitos dos itens vestidos para mostrar no inventário ("LR −3", "Sentidos Passivos −2"...). */
export function efeitosDoVestivel(item) {
  const v = VESTIVEIS[item?.id];
  if (!v) return [];
  const r = [];
  if (v.carga) r.push(`Capacidade de Carga +${v.carga}`);
  if (v.cargaVestido != null) r.push(`carga ${v.cargaVestido} vestido`);
  if (v.bolsaDeArmas) r.push('metade da carga de até 3 armas de Duas Mãos ou Desajeitadas');
  if (v.lr) r.push(`LR ${fmtSinal(v.lr)}`);
  if (v.sentidos) r.push(`Sentidos Passivos ${fmtSinal(v.sentidos)}`);
  if (v.td) r.push(`TD ${fmtSinal(v.td)}`);
  if (v.pa) r.push(`PA máximo ${fmtSinal(v.pa)} (mínimo 6)`);
  if (v.nota) r.push(v.nota);
  return r;
}

/**
 * Defesa e Tolerância a Dano: da armadura vestida (ou 10 e 0), com melhorias,
 * desgaste e os ajustes de raça, traços e trajes. A DF não fica abaixo de 10,
 * exceto quando um traço manda reduzir.
 */
export function defesas(char, catalogo) {
  const vestida = armaduraVestida(char?.inventario, catalogo);
  const est = vestida ? estatisticasDaArmadura(vestida.linha, vestida.item, catalogo) : null;
  let df = est ? est.df : 10;
  let td = est ? est.td : 0;
  df = Math.max(10, df);
  for (const v of vestidos(char, catalogo)) td += v.efeito.td || 0;
  if (char?.raca === 'robo' && char?.subtipo === 'guardatron') td += 1;
  if (temTraco(char, 'pecas_baratas')) {
    df -= 1;
    if (tracoErmo(char, 'pecas_baratas')) td -= 2;
  }
  df += char?.ajuste_df || 0;
  td += char?.ajuste_td || 0;
  return { df, td: Math.max(0, td), armadura: vestida ? (vestida.linha.nome || vestida.item.nome || null) : null };
}

// ---------------------------------------------------------------- ataques

/** Perícia de ataque de um item do catálogo (null se não for arma). */
export function periciaDaArma(item) {
  return PERICIA_DA_ARMA[item?.subcategoria] || null;
}

/**
 * Ataque com uma arma: bônus de acerto (perícia da arma), dano (dados da tabela
 * + mod. do atributo da perícia), alcance (× Percepção) e desvantagem por Força.
 */
export function calcularAtaque(char, item, antecedente = null, linha = null, catalogo = null) {
  const pericia = periciaDaArma(item);
  if (!pericia) return null;
  const atributo = atributoDaPericia(char, pericia);
  const mods = modificadores(char);
  const attr = atributosEfetivos(char);
  const est = estatisticasDaArma(linha, item, catalogo);
  const req = est.forca;
  const alcance = String(item.campos?.Alcance || '').match(/x(\d+)\s*\/\s*x(\d+)/);
  return {
    pericia,
    acerto: bonusPericia(char, pericia, antecedente) + est.acerto,
    ajusteAcerto: { mods: est.bonusMods, desgaste: est.desgaste },
    quebrada: est.quebrada || est.excedeu,
    dano: item.campos?.Dano || '',
    bonusDano: pericia === 'explosivos' ? 0 : mods[atributo],
    pa: est.pa != null && est.pa !== est.paBase ? `${est.pa} PA` : (item.campos?.PA || ''),
    critico: item.campos?.['Crítico'] || '',
    alcance: alcance ? { normal: Number(alcance[1]) * attr.PER, longo: Number(alcance[2]) * attr.PER } : null,
    desvantagemForca: req != null && attr.FOR < req,
  };
}

// ---------------------------------------------------------------- requisitos

/** Raças que contam para requisitos (Sintético com Atualizações conta também como Robô). */
function racasQueContam(char) {
  const r = [char?.raca];
  if (char?.raca === 'sintetico' && temVariante(char, 'Atualizações de Software e Hardware')) r.push('robo');
  return r;
}

/**
 * Confere os requisitos estruturados de um talento ou traço.
 * Devolve { ok, faltando: [textos], especial: texto|null }. O requisito
 * "especial" (ex.: cegueira permanente) não bloqueia: só é avisado.
 */
export function cumpreRequisitos(char, requisitos = {}) {
  const faltando = [];
  const attr = atributosEfetivos(char);
  for (const [id, min] of Object.entries(requisitos.atributos || {})) {
    if (attr[id] < min) faltando.push(`${ATRIBUTOS.find(a => a.id === id)?.nome} ${min}`);
  }
  for (const [id, max] of Object.entries(requisitos.maximo || {})) {
    if (attr[id] > max) faltando.push(`${ATRIBUTOS.find(a => a.id === id)?.nome} ${max} ou menos`);
  }
  if (requisitos.nivel && (char?.nivel || 1) < requisitos.nivel) faltando.push(`nível ${requisitos.nivel}`);
  if (requisitos.racas?.length && !requisitos.racas.some(r => racasQueContam(char).includes(r))) {
    faltando.push('raça');
  }
  return { ok: faltando.length === 0, faltando, especial: requisitos.especial || null };
}

/** Talentos já escolhidos (ids, com repetição quando o talento permite). */
export function talentosEscolhidos(char) {
  return (char?.progressao || []).filter(p => p?.tipo === 'talento' && p.talento).map(p => p.talento);
}

// ---------------------------------------------------------------- robôs

/**
 * Ferramentas acopladas dos robôs: quantas o subtipo escolhe e a perícia de
 * ataque de cada uma. O livro não diz a perícia das ferramentas de longo
 * alcance; a classificação abaixo é nossa (energia para laser, fogo e frio).
 */
export const FERRAMENTAS_ROBO = {
  maozinha: { quantidade: 3, repetir: true, pericias: { 'Serra Circular': 'corpo_a_corpo', 'Alicates': 'corpo_a_corpo', 'Broca': 'corpo_a_corpo', 'Pinça': null, 'Maçarico': 'energia' } },
  guardatron: { quantidade: 1, repetir: false, pericias: { 'Taser': 'corpo_a_corpo', 'Laser': 'energia', 'Desfibrilador': 'pugilismo', 'Spray Criogênico': 'energia', 'Pistola de Pregos': 'disparo' } },
};

/** Lê PA, dano e crítico do texto de uma ferramenta de robô ("5 Pontos de Ação. 1d8 cortante."). */
export function ataqueDaFerramenta(char, nome, texto, antecedente = null) {
  const def = FERRAMENTAS_ROBO[char?.subtipo];
  const pericia = def?.pericias?.[nome];
  if (!pericia) return null;
  const pa = String(texto).match(/(\d+)\s*(?:Pontos de Ação|PA)/);
  const dano = String(texto).match(/(?:PA|Ação)\.\s*([^.]*?\d[^.]*?)\./);
  const crit = String(texto).match(/Acerto Crítico:\s*([^.]*)\./);
  const atributo = atributoDaPericia(char, pericia);
  return {
    pericia,
    acerto: bonusPericia(char, pericia, antecedente),
    dano: dano ? dano[1].trim() : '',
    bonusDano: modificadores(char)[atributo],
    pa: pa ? `${pa[1]} PA` : '',
    critico: crit ? crit[1].trim() : '',
    alcance: null,
    desvantagemForca: false,
  };
}

// ---------------------------------------------------------------- equipamento

const NUMEROS_POR_EXTENSO = { um: 1, dois: 2, 'três': 3, quatro: 4, cinco: 5, seis: 6 };

/** Normaliza um nome para comparar com o catálogo (sem acento, caixa ou plural simples). */
function chaveNome(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').map(p => p.replace(/(?<=..)s$/, '')).join(' ');
}

/**
 * Nomes dos pacotes de antecedente que não batem com o catálogo
 * (tradução diferente ou nome genérico) -> id do item.
 */
const APELIDOS_DE_ITEM = {
  'barraca individual': 'itens_e_equipamentos_barraca_uma_pessoa',
  'roupa do refúgio': 'itens_unicos_traje_de_refugio',
  'pip-boy': 'itens_unicos_pip_boy_2000',
  'balas .44': 'municao_de_armas_de_fogo_44_magnum',
  'escopeta de cano único': 'escopetas_escopeta_de_tiro_unico',
  'escopeta de um tiro': 'escopetas_escopeta_de_tiro_unico',
  'bastão policial': 'armas_contundentes_cassetete',
  'carabina de caça': 'rifles_carabina_de_trilha',
  'armadura improvisada': 'armaduras_multicamadas',
  'bife salisbury': 'comida_pronta_bife_a_salisbury',
  'blamco mac&queijo': 'comida_pronta_macarrao_com_queijo_blamco',
  'ovos yum yum': 'comida_pronta_ovos_recheados_yum_yum',
  'ração de cachorro enlatada': 'comida_pronta_racao_de_cachorro_em_lata',
  'batatinha': 'comida_pronta_batatinhas_crocantes',
  'ensopado mutacervo': 'comida_cozida_ensopado_de_radcervo',
  'sopa de vegetais': 'comida_cozida_sopa_de_legumes',
  'bife de lagartixa': 'comida_cozida_bife_de_lagarto',
  'robco consertajá': 'medicina_robco_consertaja_1_0',
  'rolamentos': 'itens_e_equipamentos_esferas_de_aco',
  'mutamaçã': 'produtos_mutfruta',
  'seringas disparáveis de stimpak': 'municao_especial_seringador_carregador_de_stimpak',
  'seringa': 'rifles_seringador',
  'seringa de tétano': 'municao_especial_seringador_articulacao_travada',
};
const APELIDOS = Object.fromEntries(Object.entries(APELIDOS_DE_ITEM).map(([k, v]) => [chaveNome(k), v]));

/** Lê "dois Níveis de Desgaste" -> 2. */
function lerNumero(txt) {
  const t = String(txt).toLowerCase();
  return NUMEROS_POR_EXTENSO[t] ?? Number(t);
}

/**
 * Converte o texto de um pacote de equipamento ("x1 faca, x2 Stimpaks e x50
 * tampinhas.") em linhas de inventário. Cada item é ligado ao catálogo quando
 * o nome bate (inteiro, apelido ou o catálogo contido no texto) e recebe o nome
 * do catálogo; "com dois Níveis de Desgaste" vira o campo desgaste e "com
 * melhoria Chumbada nível 1" vira melhoria instalada (em armaduras). O que
 * sobra de observação vai para a nota. Tampinhas viram moeda.
 * Devolve { linhas: [{ nome, qtd, ref, desgaste, melhorias, nota }], tampinhas }.
 */
export function interpretarPacote(texto, itens = []) {
  const indice = itens.map(i => ({ i, k: chaveNome(i.nome) })).filter(x => x.k).sort((a, b) => b.k.length - a.k.length);
  const porId = Object.fromEntries(itens.map(i => [i.id, i]));
  const melhoriasArmadura = itens.filter(i => i.subcategoria === 'Melhorias de Armadura');
  const partes = String(texto || '').replace(/\.\s*$/, '').split(/,\s*|\s+e\s+(?=x?\d)/);
  const linhas = [];
  let tampinhas = 0;
  for (let parte of partes) {
    parte = parte.trim();
    if (!parte) continue;
    const m = parte.match(/^x?(\d+)\s+(.*)$/i);
    const qtd = m ? Number(m[1]) : 1;
    const nome = (m ? m[2] : parte).trim();
    if (/^tampinhas?$/i.test(nome)) { tampinhas += qtd; continue; }
    // O nome do item é o que vem antes de "(...)" e de " com ...".
    const base = nome.replace(/\(.*?\)/g, '').replace(/\s+com\s+.*$/i, '').trim();
    const extra = [...nome.matchAll(/\((.*?)\)/g)].map(x => x[1]).join(' ')
      + ' ' + (nome.replace(/\(.*?\)/g, '').match(/\s+com\s+(.*)$/i)?.[1] || '');
    const kBase = chaveNome(base);
    const kArmadura = kBase.startsWith('armadura de ') ? kBase.slice(12) : null;
    const achado = (APELIDOS[kBase] && porId[APELIDOS[kBase]] && { i: porId[APELIDOS[kBase]] })
      || (kArmadura && indice.find(x => x.k === kArmadura && x.i.categoria === 'Armaduras'))
      || indice.find(x => x.k === kBase)
      || indice.find(x => (` ${kBase} `).includes(` ${x.k} `));
    const item = achado?.i || null;

    let resto = extra.trim();
    let desgaste = 0;
    const d = resto.match(/(\d+|um|dois|três|quatro|cinco|seis)\s+Níve(?:l|is) de Desgaste/i);
    if (d) { desgaste = lerNumero(d[1]); resto = resto.replace(d[0], ''); }
    const melhorias = [];
    if (item && ehArmadura(item)) {
      const mm = resto.match(/melhoria\s+([\p{L} ]+?)(?:\s+nível\s+(\d+))?\s*$/iu);
      const mel = mm && melhoriasArmadura.find(x => chaveNome(x.nome) === chaveNome(mm[1]));
      if (mel) { melhorias.push({ id: idMelhoria(mel), nivel: Number(mm[2]) || 1 }); resto = resto.replace(mm[0], ''); }
    }
    resto = resto.replace(/^\s*(com|e)\s+|\s+(com|e)\s*$/gi, '').trim();
    // Fica o nome do catálogo; munição e armadura mantêm o nome do pacote
    // ("Munição 9mm", "Armadura de couro"), que diz mais que "9mm" ou "Couro".
    const manterBase = !item || item.categoria === 'Munição' || (ehArmadura(item) && /^armadura/i.test(base));
    const linha = {
      nome: manterBase ? base.charAt(0).toUpperCase() + base.slice(1) : item.nome,
      qtd,
      ref: item?.id || null,
      desgaste,
    };
    if (melhorias.length) linha.melhorias = melhorias;
    if (/^qualquer$/i.test(resto)) resto = 'qualquer modelo';
    if (resto) linha.nota = resto.charAt(0).toUpperCase() + resto.slice(1);
    linhas.push(linha);
  }
  return { linhas, tampinhas };
}

/** Pacote de equipamento do antecedente que serve para a raça (ou o primeiro). */
export function pacoteDaRaca(antecedente, raca) {
  const pacotes = antecedente?.equipamento || [];
  return pacotes.find(p => p.racas.includes(raca)) || pacotes[0] || null;
}

// ---------------------------------------------------------------- dano e descanso

/**
 * Aplica dano na Ordem do Dano: PE temporários, PE, resistência/vulnerabilidade,
 * TD, PV temporários, PV. Com `direto` (inconsciente ou sem perceber o ataque)
 * o dano pula a estamina. Devolve o novo estado e o que aconteceu.
 */
export function aplicarDano(estado, dano, { td = 0, resistente = false, vulneravel = false, direto = false } = {}) {
  const s = { pe_temp: 0, pe: 0, pv_temp: 0, pv: 0, ...estado };
  let resto = Math.max(0, Math.floor(dano));
  if (!direto) {
    const t = Math.min(s.pe_temp, resto); s.pe_temp -= t; resto -= t;
    const p = Math.min(s.pe, resto); s.pe -= p; resto -= p;
  }
  let naVida = 0;
  if (resto > 0) {
    if (resistente && !vulneravel) resto = Math.floor(resto / 2);
    if (vulneravel && !resistente) resto *= 2;
    resto = Math.max(0, resto - td);
    const t = Math.min(s.pv_temp, resto); s.pv_temp -= t; resto -= t;
    naVida = Math.min(s.pv, resto);
    s.pv -= naVida;
    resto -= naVida;
  }
  if (s.pv === 0) s.pe = 0; // a 0 PV a estamina também zera
  return { ...s, sobra: resto, chegouAZero: s.pv === 0 && (estado.pv || 0) > 0 };
}

/** Raças que descansam como máquina (Sintético Gen 2 e Robô). */
export function descansaComoMaquina(char) {
  return char?.raca === 'robo' || char?.raca === 'sintetico';
}

/**
 * Efeito de um descanso (capítulo O Ambiente, ainda na versão em inglês):
 * - curto (1 h): orgânicos voltam a metade dos PE; máquinas, PE cheios.
 * - longo (6 h orgânico, 2 h máquina): PV += Fator de Cura (máquinas usam a
 *   maior entre INT e PER no lugar da RES), −1 Exaustão; orgânicos que dormem
 *   confortáveis enchem os PE. Sem conforto, PE e PV recuperados caem à metade.
 */
export function efeitoDescanso(char, tipo, confortavel = true, catalogo = null) {
  const maqui = descansaComoMaquina(char);
  const peMax = peMaximo(char, catalogo);
  const pvMax = pvMaximo(char);
  const peAtual = char?.pe_atual ?? peMax;
  const pvAtual = char?.pv_atual ?? pvMax;
  const fator = confortavel ? 1 : 0.5;
  let pe = peAtual;
  let pv = pvAtual;
  let exaustao = char?.exaustao || 0;
  if (tipo === 'curto') {
    const alvo = maqui ? peMax : Math.floor(peMax / 2);
    pe = Math.max(peAtual, peAtual + Math.floor((alvo - peAtual) * fator));
  } else {
    const attr = atributosEfetivos(char);
    const base = maqui ? Math.max(attr.INT, attr.PER) : attr.RES;
    const cura = Math.floor(Math.floor(((char?.nivel || 1) + base) / 2) * fator);
    pv = Math.min(pvMax, pvAtual + cura);
    pe = maqui || confortavel ? peMax : Math.max(peAtual, Math.floor(peMax / 2));
    exaustao = Math.max(0, exaustao - 1);
  }
  return { pe_atual: pe, pv_atual: pv, exaustao, pe_temp: 0, pv_temp: 0 };
}

// ---------------------------------------------------------------- munição

/**
 * Munição de uma arma à distância, lida de "Munição e Recarga":
 * "10mm, 12 balas" (pente em balas) ou "1 Célula de Energia = 30 disparos"
 * (cada célula enche o pente com N disparos). null se não usar munição.
 */
export function municaoDaArma(item, linha = null, catalogo = null) {
  const txt = String(item?.campos?.['Munição e Recarga'] || '').trim();
  let m = txt.match(/^\(?1\)?\s+(.+?)\s*=\s*(\d+)\s*disparos?/i);
  if (m) return { tipo: m[1].trim(), capacidade: Number(m[2]), porCarga: true };
  m = txt.match(/^(.+?),\s*(\d+)\s*balas?/i);
  if (m && m[1].length <= 30) {
    // Carregador Ampliado: +3 balas.
    const extra = linha ? estatisticasDaArma(linha, item, catalogo).pente : 0;
    return { tipo: m[1].trim(), capacidade: Number(m[2]) + extra, porCarga: false };
  }
  return null;
}

/** A cada quantas recargas uma arma à distância ganha um nível de desgaste. */
export const RECARGAS_POR_DESGASTE = 10;

/**
 * Como o item ganha níveis de desgaste e o que eles fazem (Itens e Custo,
 * Fabricação), já com as propriedades de desgaste da arma.
 */
export function regraDeDesgaste(item, linha = null, catalogo = null) {
  const pericia = periciaDaArma(item);
  const fim = ' No 10º nível o item quebra e para de funcionar.';
  if (pericia && pericia !== 'explosivos') {
    const cc = ['corpo_a_corpo', 'pugilismo'].includes(pericia);
    const p = propriedadesDeDesgaste(linha, item, catalogo);
    const ganha = [];
    if (!cc) ganha.push(p.has('Instável') ? 'a cada cinco recargas (Instável)' : 'na décima recarga');
    if (p.has('Quebrável')) ganha.push('quando você tira 3 ou menos na rolagem de ataque (Quebrável)');
    else if (!p.has('Durável')) ganha.push('quando você tira 1 na rolagem de ataque');
    if (cc) ganha.push('quando você a arremessa sem ela ter a propriedade Arremessável');
    let txt = `${cc ? 'Esta arma corpo a corpo' : 'Esta arma à distância'} ganha um nível de desgaste ${ganha.join(', ').replace(/, ([^,]*)$/, ' e $1')}.`;
    if (p.has('Durável')) txt += ' Durável: não ganha desgaste ao tirar 1.';
    txt += ' Cada nível reduz em 1 as rolagens de ataque.';
    if (p.has('Robusto')) txt += ' Robusto: ignora os 2 primeiros níveis.';
    if (p.has('Frágil')) return txt + ' Frágil: quebra e para de funcionar ao ganhar o primeiro nível.';
    return txt + fim;
  }
  if (/traje_hazmat/.test(item?.id || '')) {
    return 'A cada 5 pontos de dano que você sofre nos PV enquanto veste o traje, ele ganha um nível de desgaste.' + fim;
  }
  if (ehArmadura(item)) {
    return 'A armadura ganha um nível de desgaste se você a está vestindo e é alvo de um acerto crítico, ou sempre que você chega a 0 PV. DF e TD caem metade dos níveis (para baixo); a DF não fica abaixo de 10 nem a TD abaixo de 0. A melhoria Robusta ignora os 2 ou 4 primeiros níveis.' + fim;
  }
  return 'Itens só ganham desgaste se a descrição disser, se sofrerem dano de um ataque mirado ou por decisão do MJ.' + fim;
}

/**
 * Pip-Boy vestido com Traje de Refúgio de até 5 níveis de desgaste: cura de PV
 * ganha um adicional igual ao nível. Devolve o adicional (0 se não vale).
 */
export function bonusCuraPipBoy(char, catalogo) {
  if (!catalogo) return 0;
  const vestidos = (char?.inventario || []).filter(l => l.equipado);
  const pip = vestidos.some(l => /^itens_unicos_pip_boy/.test(l.ref || ''));
  const traje = vestidos.some(l => l.ref === 'itens_unicos_traje_de_refugio' && (l.desgaste || 0) <= 5);
  return pip && traje ? (char?.nivel || 1) : 0;
}

/**
 * Linhas do inventário que servem de reserva para o tipo de munição: itens do
 * catálogo de Munição ou itens livres cujo nome contém o tipo ("Balas .44").
 */
export function linhasDeMunicao(inventario, catalogo, tipo) {
  const k = chaveNome(tipo);
  if (!k) return [];
  return (inventario || []).filter(l => {
    const item = catalogo?.[l.ref];
    if (item && item.categoria !== 'Munição') return false;
    const nome = ` ${chaveNome(item?.nome || l.nome)} `;
    return nome.includes(` ${k} `) || (item && ` ${k} `.includes(` ${chaveNome(item.nome)} `));
  });
}

/** Total de munição de reserva no inventário. */
export function municaoNoInventario(inventario, catalogo, tipo) {
  return linhasDeMunicao(inventario, catalogo, tipo).reduce((s, l) => s + (l.qtd || 0), 0);
}

/**
 * Recarrega: armas de bala tiram do inventário o que falta no pente; armas
 * de carga gastam 1 carga (célula, núcleo) e enchem o pente.
 * Devolve { pente, gasto } (gasto = quanto sai do inventário).
 */
export function recarregar(municao, pente, reserva) {
  if (!municao || pente >= municao.capacidade || reserva <= 0) return { pente, gasto: 0 };
  if (municao.porCarga) return { pente: municao.capacidade, gasto: 1 };
  const gasto = Math.min(municao.capacidade - pente, reserva);
  return { pente: pente + gasto, gasto };
}
