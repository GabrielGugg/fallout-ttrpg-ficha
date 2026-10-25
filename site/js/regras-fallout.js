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

/** Perícias e atributos possíveis; o primeiro é o padrão. */
export const PERICIAS = [
  { id: 'barganha', nome: 'Barganha', atributos: ['CAR'] },
  { id: 'sabotagem', nome: 'Sabotagem', atributos: ['PER', 'INT'] },
  { id: 'criacao', nome: 'Criação', atributos: ['INT'] },
  { id: 'energia', nome: 'Energia', atributos: ['PER'] },
  { id: 'explosivos', nome: 'Explosivos', atributos: ['PER'] },
  { id: 'disparo', nome: 'Disparo', atributos: ['AGI'] },
  { id: 'intimidacao', nome: 'Intimidação', atributos: ['FOR', 'CAR'] },
  { id: 'medicina', nome: 'Medicina', atributos: ['PER', 'INT'] },
  { id: 'corpo_a_corpo', nome: 'Corpo a Corpo', atributos: ['FOR'] },
  { id: 'ciencia', nome: 'Ciência', atributos: ['INT'] },
  { id: 'furtividade', nome: 'Furtividade', atributos: ['AGI'] },
  { id: 'persuasao', nome: 'Persuasão', atributos: ['CAR'] },
  { id: 'sobrevivencia', nome: 'Sobrevivência', atributos: ['RES'] },
  { id: 'pugilismo', nome: 'Pugilismo', atributos: ['FOR'] },
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
 * Contadores de nível que reduzem em 1 cada d20 (exceto Sorte) por nível.
 * `limite`: o máximo possível; `morte`: chegar nele mata.
 */
export const CONTADORES_SOBREVIVENCIA = [
  { id: 'fome', nome: 'Fome', condicao: 'Fome', limite: 10, morte: true },
  { id: 'desidratacao', nome: 'Desidratação', condicao: 'Desidratação', limite: 10, morte: true },
  { id: 'fadiga', nome: 'Fadiga', condicao: 'Fadiga', limite: 9, morte: false },
  { id: 'exaustao', nome: 'Exaustão', condicao: 'Exaustão', limite: 10, morte: true },
  { id: 'radiacao', nome: 'Radiação', condicao: 'Radiação ou Rads', limite: 10, morte: true },
];

/**
 * Contadores que se aplicam à raça: Sintético Gen 2 e Robô não comem, não
 * bebem e não ganham rads; Necrótico e Super Mutante não ganham rads.
 */
export function contadoresDaRaca(char) {
  const fora = new Set();
  if (['sintetico', 'robo'].includes(char?.raca)) ['fome', 'desidratacao', 'radiacao'].forEach(x => fora.add(x));
  if (['necrotico', 'super_mutante'].includes(char?.raca)) fora.add('radiacao');
  return CONTADORES_SOBREVIVENCIA.filter(c => !fora.has(c.id));
}

/** Redutor total dos d20 (exceto Sorte) pelos níveis de sobrevivência. */
export function penalidadeD20(char) {
  return contadoresDaRaca(char).reduce((s, c) => s + Math.max(0, char?.[c.id] || 0), 0);
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
  return Math.max(1, maximoTabela(char?.nivel || 1, modificadores(char).RES) + (char?.ajuste_pv || 0));
}

/** Pontos de Estamina máximos (Agilidade), com a mesma regra retroativa. */
export function peMaximo(char) {
  return Math.max(0, maximoTabela(char?.nivel || 1, modificadores(char).AGI) + (char?.ajuste_pe || 0));
}

/** Pontos de Ação: 10 + mod. de Agilidade, no máximo 15. */
export function pontosDeAcao(char) {
  return Math.min(15, 10 + modificadores(char).AGI);
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

/** Capacidade de Carga: Força × 10 (+40 para Super Mutante). */
export function capacidadeDeCarga(char) {
  let c = atributosEfetivos(char).FOR * 10;
  if (char?.raca === 'super_mutante') c += 40;
  return c;
}

/** Sentidos Passivos: 12 + mod. de Percepção. */
export function sentidosPassivos(char) {
  return 12 + modificadores(char).PER;
}

/** Limiar de Radiação (só Humano): 12 − mod. de Resistência (+3 com Metabolismo Rápido). */
export function limiarDeRadiacao(char) {
  if (char?.raca !== 'humano') return null;
  let lr = 12 - modificadores(char).RES;
  if (temTraco(char, 'metabolismo_rapido') && !tracoErmo(char, 'metabolismo_rapido')) lr += 3;
  return lr;
}

/** Tampas de Karma: 1, +1 com Sorte 10, +1 com Engenhoso (Humano variante). */
export function tampasDeKarma(char) {
  let n = 1;
  if (atributosEfetivos(char).SOR >= 10) n++;
  if (char?.raca === 'humano' && temVariante(char, 'Engenhoso')) n++;
  return n;
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

/** Carga unitária de um item do catálogo. */
export function cargaDoItem(item) {
  const campo = Object.entries(item?.campos || {}).find(([k]) => k.startsWith('Carga'));
  if (!campo) return 0;
  const n = numeroApos(campo[1], 'Carga');
  return n ?? (Number(String(campo[1]).replace(',', '.')) || 0);
}

/** Armadura vestida no inventário (a primeira marcada como equipada). */
export function armaduraVestida(inventario, catalogo) {
  for (const linha of inventario || []) {
    if (!linha.equipado) continue;
    const item = catalogo?.[linha.ref];
    if (item?.categoria === 'Armaduras' && !item.subcategoria) return { linha, item };
  }
  return null;
}

/**
 * Defesa e Tolerância a Dano: da armadura vestida (ou 10 e 0), com os ajustes de
 * raça e traços. A DF não fica abaixo de 10, exceto quando um traço manda reduzir.
 */
export function defesas(char, catalogo) {
  const vestida = armaduraVestida(char?.inventario, catalogo);
  let df = vestida ? Number(vestida.item.campos.DF) || 10 : 10;
  let td = vestida ? Number(vestida.item.campos.TD) || 0 : 0;
  df = Math.max(10, df);
  if (char?.raca === 'robo' && char?.subtipo === 'guardatron') td += 1;
  if (temTraco(char, 'pecas_baratas')) {
    df -= 1;
    if (tracoErmo(char, 'pecas_baratas')) td -= 2;
  }
  df += char?.ajuste_df || 0;
  td += char?.ajuste_td || 0;
  return { df, td: Math.max(0, td), armadura: vestida?.item?.nome || null };
}

/** Carga total do inventário; armadura vestida conta pela metade. */
export function cargaTotal(char, catalogo) {
  let total = 0;
  for (const linha of char?.inventario || []) {
    const item = catalogo?.[linha.ref];
    const unit = linha.carga != null ? Number(linha.carga) : cargaDoItem(item);
    const vestida = linha.equipado && item?.categoria === 'Armaduras' && !item?.subcategoria;
    total += (vestida ? unit / 2 : unit) * (linha.qtd || 1);
  }
  return Math.round(total * 10) / 10;
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
export function calcularAtaque(char, item, antecedente = null) {
  const pericia = periciaDaArma(item);
  if (!pericia) return null;
  const atributo = atributoDaPericia(char, pericia);
  const mods = modificadores(char);
  const attr = atributosEfetivos(char);
  const req = requisitoForca(item);
  const alcance = String(item.campos?.Alcance || '').match(/x(\d+)\s*\/\s*x(\d+)/);
  return {
    pericia,
    acerto: bonusPericia(char, pericia, antecedente),
    dano: item.campos?.Dano || '',
    bonusDano: pericia === 'explosivos' ? 0 : mods[atributo],
    pa: item.campos?.PA || '',
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
 * Converte o texto de um pacote de equipamento ("x1 faca, x2 Stimpaks e x50
 * tampinhas.") em linhas de inventário. Cada item é ligado ao catálogo quando
 * o nome bate (inteiro, ou o catálogo contido no texto); tampinhas viram moeda.
 * Devolve { linhas: [{ nome, qtd, ref, nota }], tampinhas }.
 */
export function interpretarPacote(texto, itens = []) {
  const indice = itens.map(i => ({ i, k: chaveNome(i.nome) })).filter(x => x.k).sort((a, b) => b.k.length - a.k.length);
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
    // Para casar com o catálogo, tira o que é observação: "(com melhoria...)",
    // "com dois Níveis de Desgaste" e o prefixo "armadura de".
    const base = nome.replace(/\(.*?\)/g, '').replace(/\s+com\s+.*$/i, '').trim();
    const kBase = chaveNome(base);
    const kArmadura = kBase.startsWith('armadura de ') ? kBase.slice(12) : null;
    const achado = (kArmadura && indice.find(x => x.k === kArmadura && x.i.categoria === 'Armaduras'))
      || indice.find(x => x.k === kBase)
      || indice.find(x => (` ${kBase} `).includes(` ${x.k} `));
    const desgaste = nome.match(/(\d+|um|dois|três|quatro|cinco|seis)\s+Níve(?:l|is) de Desgaste/i);
    linhas.push({
      nome: nome.charAt(0).toUpperCase() + nome.slice(1),
      qtd,
      ref: achado?.i.id || null,
      desgaste: desgaste ? (NUMEROS_POR_EXTENSO[desgaste[1].toLowerCase()] ?? Number(desgaste[1])) : 0,
    });
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
export function efeitoDescanso(char, tipo, confortavel = true) {
  const maqui = descansaComoMaquina(char);
  const peMax = peMaximo(char);
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
export function municaoDaArma(item) {
  const txt = String(item?.campos?.['Munição e Recarga'] || '').trim();
  let m = txt.match(/^\(?1\)?\s+(.+?)\s*=\s*(\d+)\s*disparos?/i);
  if (m) return { tipo: m[1].trim(), capacidade: Number(m[2]), porCarga: true };
  m = txt.match(/^(.+?),\s*(\d+)\s*balas?/i);
  if (m && m[1].length <= 30) return { tipo: m[1].trim(), capacidade: Number(m[2]), porCarga: false };
  return null;
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
