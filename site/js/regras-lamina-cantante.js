// ============================================================
// Regras puras da Lâmina Cantante (Mago, Tasha's). Sem DOM; recebe o
// personagem. Não importa utils.js: utils.js (calcCA) importa este módulo.
// ============================================================
import { nivelNa, nivelTotal, subclasseDe } from './regras-multiclasse.js';
import { estaIncapacitado } from './regras-condicoes.js';
import { atributoEfetivo } from './regras-atributos.js';
import { equipamentoDeCA } from './regras-itens-magicos.js';

export const SUBCLASSE_LAMINA = 'Lâmina Cantante';

/** Se o personagem é Mago Lâmina Cantante de nível 3 ou mais. */
export function ehLaminaCantante(p) {
  return subclasseDe(p, 'Mago') === SUBCLASSE_LAMINA && (nivelNa(p, 'Mago') || 0) >= 3;
}

/** Estado da Canção em recursos.mago.subclasses.lamina_cantante, criado com guarda. */
export function estadoCancao(p) {
  if (!p.recursos) p.recursos = {};
  if (!p.recursos.mago) p.recursos.mago = {};
  if (!p.recursos.mago.subclasses) p.recursos.mago.subclasses = {};
  const s = p.recursos.mago.subclasses.lamina_cantante || (p.recursos.mago.subclasses.lamina_cantante = {});
  if (typeof s.ativa !== 'boolean') s.ativa = false;
  if (typeof s.usos_gastos !== 'number') s.usos_gastos = 0;
  return s;
}

/** Usos por descanso: bônus de proficiência do nível total. */
export function usosMaxCancao(p) {
  const n = nivelTotal(p) || 1;
  return 2 + Math.floor((n - 1) / 4);
}

/** Usos ainda disponíveis. */
export function usosRestantesCancao(p) {
  return Math.max(0, usosMaxCancao(p) - estadoCancao(p).usos_gastos);
}

/** Modificador de Inteligência em jogo, mínimo +1 (CA, concentração e dano). */
export function bonusCancao(p) {
  return Math.max(1, Math.floor(((atributoEfetivo(p, 'inteligencia') ?? 10) - 10) / 2));
}

/** Motivo que impede a Canção (armadura Média/Pesada, Escudo, Incapacitado), ou ''. */
export function impedimentoCancao(p) {
  const { armadura, escudo } = equipamentoDeCA(p);
  if (escudo) return 'Com Escudo empunhado a Canção da Lâmina não funciona.';
  if (['Média', 'Pesada'].includes(armadura?.dados?.categoria)) return 'Com armadura Média ou Pesada a Canção da Lâmina não funciona.';
  if (estaIncapacitado(p.condicoes || [])) return 'Incapacitado: a Canção da Lâmina termina.';
  return '';
}

/** Canção valendo agora: estado ativo, Lâmina Cantante e sem impedimento. */
export function cancaoAtiva(p) {
  return ehLaminaCantante(p) && !!p?.recursos?.mago?.subclasses?.lamina_cantante?.ativa && !impedimentoCancao(p);
}

/** Inicia a Canção gastando um uso; recusa com impedimento, sem usos ou já ativa. */
export function iniciarCancao(p) {
  if (!ehLaminaCantante(p)) return { ok: false, motivo: 'Exige Lâmina Cantante de nível 3.' };
  const motivo = impedimentoCancao(p);
  if (motivo) return { ok: false, motivo };
  const e = estadoCancao(p);
  if (e.ativa) return { ok: false, motivo: 'A Canção da Lâmina já está ativa.' };
  if (usosRestantesCancao(p) <= 0) return { ok: false, motivo: 'Sem usos: recupere com um Descanso Curto ou Longo.' };
  e.usos_gastos += 1;
  e.ativa = true;
  return { ok: true };
}

/** Encerra a Canção. */
export function encerrarCancao(p) {
  estadoCancao(p).ativa = false;
}

/** Encerra a Canção gravada como ativa quando há impedimento; true se encerrou. */
export function encerrarCancaoSeImpedida(p) {
  if (!p?.recursos?.mago?.subclasses?.lamina_cantante?.ativa || !impedimentoCancao(p)) return false;
  encerrarCancao(p);
  return true;
}

/** Descanso Curto ou Longo: encerra a Canção e devolve todos os usos. */
export function descansoCancao(p) {
  if (!ehLaminaCantante(p)) return;
  const e = estadoCancao(p);
  e.ativa = false;
  e.usos_gastos = 0;
}

/** Dano reduzido pela Canção da Defesa: 5 × círculo do espaço gasto. */
export function reducaoCancaoDefesa(circulo) {
  return 5 * (Number(circulo) || 0);
}

/** Canção da Defesa disponível: Canção ativa e Mago 10+. */
export function podeCancaoDefesa(p) {
  return cancaoAtiva(p) && (nivelNa(p, 'Mago') || 0) >= 10;
}

/** Bônus de dano corpo a corpo da Canção da Vitória (Mago 14+, Canção ativa); 0 fora disso. */
export function bonusDanoCancaoVitoria(p) {
  return cancaoAtiva(p) && (nivelNa(p, 'Mago') || 0) >= 14 ? bonusCancao(p) : 0;
}
