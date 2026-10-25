// ============================================================
// Persistência dos personagens no localStorage do aparelho
// ============================================================
import { gerarId } from './utils.js';

const STORAGE_KEY = 'fallout_personagens';
export const SISTEMA = 'fallout-ttrpg-2.1';
export const SCHEMA_VERSAO = 1;

/** Lista todos os personagens salvos neste aparelho. */
export function listarPersonagens() {
  try {
    const lista = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

/** Grava a lista inteira. */
function gravar(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

/** Busca um personagem pelo id. */
export function getPersonagem(id) {
  return listarPersonagens().find(p => p.id === id) || null;
}

/** Salva (cria ou atualiza) um personagem e carimba a data. */
export function salvarPersonagem(p) {
  const lista = listarPersonagens();
  if (!p.id) p.id = gerarId();
  if (!p.criado_em) p.criado_em = new Date().toISOString();
  p.atualizado_em = new Date().toISOString();
  const i = lista.findIndex(x => x.id === p.id);
  if (i >= 0) lista[i] = p; else lista.push(p);
  gravar(lista);
  return p;
}

/** Remove um personagem. */
export function removerPersonagem(id) {
  gravar(listarPersonagens().filter(p => p.id !== id));
}

/** Duplica um personagem com novo id. */
export function duplicarPersonagem(id) {
  const orig = getPersonagem(id);
  if (!orig) return null;
  const copia = JSON.parse(JSON.stringify(orig));
  copia.id = gerarId();
  copia.nome = `${copia.nome} (cópia)`;
  copia.criado_em = null;
  return salvarPersonagem(copia);
}

/** Exporta um ou todos os personagens como texto JSON (sempre uma lista). */
export function exportar(id = null) {
  const lista = id ? [getPersonagem(id)].filter(Boolean) : listarPersonagens();
  return JSON.stringify(lista, null, 2);
}

/**
 * Importa personagens de um JSON exportado por este app. Ignora fichas de
 * outro sistema (ex.: D&D) e dá id novo a quem colidir com um existente.
 * Devolve { importados, ignorados }.
 */
export function importar(texto) {
  const dados = JSON.parse(texto);
  const entrada = Array.isArray(dados) ? dados : [dados];
  const lista = listarPersonagens();
  let importados = 0;
  let ignorados = 0;
  for (const p of entrada) {
    if (!p || p.sistema !== SISTEMA) { ignorados++; continue; }
    if (lista.some(x => x.id === p.id)) p.id = gerarId();
    lista.push(p);
    importados++;
  }
  gravar(lista);
  return { importados, ignorados };
}

/** Personagem novo, vazio, no schema atual. */
export function criarPersonagemVazio() {
  return {
    id: null,
    sistema: SISTEMA,
    schema_versao: SCHEMA_VERSAO,
    nome: '',
    raca: null,
    subtipo: null,
    variantes: [],
    ferramentas_robo: [],
    special: { FOR: 5, PER: 5, RES: 5, CAR: 5, INT: 5, AGI: 5, SOR: 5 },
    antecedente: null,
    pericias_antecedente: [],
    atributo_pericia: {},
    pontos_pericia: {},
    nivel: 1,
    xp: 0,
    progressao: [],
    tracos: { personagem: [], antecedente: null },
    equipamento_escolha: 'antecedente',
    inventario: [],
    tampinhas: 0,
    pv_atual: null,
    pe_atual: null,
    pe_temp: 0,
    pv_temp: 0,
    karma_viradas: 0,
    fome: 0,
    desidratacao: 0,
    fadiga: 0,
    exaustao: 0,
    radiacao: 0,
    condicoes: [],
    suspiros: { sucessos: 0, falhas: 0 },
    detalhes: { idade: '', aparencia: '', personalidade: '', historia: '', jogador: '' },
    notas: '',
  };
}
