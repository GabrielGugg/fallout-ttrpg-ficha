// ============================================================
// Ficha: Lâmina Cantante (Mago, Tasha's). Card da Canção da Lâmina
// (ativar, encerrar, usos) e popup da Canção da Defesa.
// ============================================================
import { char, salvar } from './estado.js';
import { abrirModal, toast } from '../utils.js';
import { renderFichaCompleta } from './ficha.js';
import { gastarEspaco, reservasDeEspacos } from './reservas-espacos.js';
import {
  bonusCancao, cancaoAtiva, ehLaminaCantante, encerrarCancao, impedimentoCancao, iniciarCancao,
  podeCancaoDefesa, reducaoCancaoDefesa, usosMaxCancao,
} from '../regras-lamina-cantante.js';
import { nivelNa } from '../regras-multiclasse.js';

/** Reservas de espaço com ao menos um disponível, para a Canção da Defesa. */
function reservasLivres() {
  return reservasDeEspacos().filter((r) => r.disponiveis > 0);
}

/** Card recolhível da Canção da Lâmina; vazio fora da Lâmina Cantante 3+. */
export function renderSecaoLaminaCantante() {
  if (!ehLaminaCantante(char)) return '';
  const ativa = cancaoAtiva(char);
  const motivo = impedimentoCancao(char);
  // Leitura sem criar estado: o render não grava na ficha.
  const restantes = Math.max(0, usosMaxCancao(char) - (char.recursos?.mago?.subclasses?.lamina_cantante?.usos_gastos || 0));
  const bonus = bonusCancao(char);
  const nivel = nivelNa(char, 'Mago') || 0;
  const efeitos = [`CA +${bonus}`, 'Deslocamento +3 m', 'Vantagem em Acrobacia', `+${bonus} na Concentração`];
  if (nivel >= 14) efeitos.push(`+${bonus} no dano corpo a corpo`);
  const defesa = nivel >= 10
    ? `<button class="btn btn-sm btn-secondary" data-cancao-acao="defesa" ${podeCancaoDefesa(char) && reservasLivres().length ? '' : 'disabled'}>Canção da Defesa</button>`
    : '';
  return `
  <div class="card">
    <details class="card-recolhivel" data-details-id="lamina-cantante">
      <summary class="card-header card-recolhivel-titulo">
        <h2>Canção da Lâmina</h2>
        <span class="badge ${ativa ? 'badge-success' : 'badge-secondary'}" style="margin-left:auto">${ativa ? 'Ativa' : 'Inativa'}</span>
        <span style="font-size:0.75rem;margin-left:6px">${restantes}/${usosMaxCancao(char)}</span>
        <span class="card-recolhivel-chevron no-print">&#9660;</span>
      </summary>
      <div style="padding:8px 10px">
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">${efeitos.join(' · ')}</div>
        ${motivo ? `<div style="font-size:0.8rem;color:var(--danger);margin-bottom:6px">${motivo}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">Dura 1 minuto; termina se você atacar com uma arma usando as duas mãos.</div>
        <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap">
          ${ativa
    ? '<button class="btn btn-sm btn-secondary" data-cancao-acao="encerrar">Encerrar</button>'
    : `<button class="btn btn-sm btn-primary" data-cancao-acao="ativar" ${motivo || restantes <= 0 ? 'disabled' : ''}>Ativar (Ação Bônus)</button>`}
          ${defesa}
        </div>
      </div>
    </details>
  </div>`;
}

/** Popup com um card por reserva de espaço livre; escolher gasta o espaço e mostra a redução. */
function abrirCancaoDefesa() {
  const cards = reservasLivres().map((r) => `
    <div class="opcao-card" data-cancao-defesa-circulo="${r.fonte}:${r.circulo}" style="padding:8px 10px;margin-bottom:6px;cursor:pointer">
      <strong>${r.circulo}º círculo${r.fonte === 'pacto' ? ' (Pacto)' : ''}</strong>
      <div style="font-size:0.8rem">Reduz ${reducaoCancaoDefesa(r.circulo)} de dano · ${r.disponiveis} disponível(is)</div>
    </div>`).join('');
  abrirModal('Canção da Defesa', `<p style="font-size:0.85rem">Reação ao sofrer dano: gaste um espaço de magia.</p>${cards}`);
  document.querySelectorAll('[data-cancao-defesa-circulo]').forEach((el) => {
    el.addEventListener('click', () => {
      const [fonte, circulo] = el.dataset.cancaoDefesaCirculo.split(':');
      if (!gastarEspaco(char, fonte, Number(circulo))) { toast('Esse espaço não está mais disponível.', 'error'); return; }
      salvar();
      window.fecharModal?.();
      toast(`Canção da Defesa: reduza ${reducaoCancaoDefesa(circulo)} do dano (Reação).`, 'success');
      renderFichaCompleta();
    });
  });
}

/** Liga os botões do card da Canção da Lâmina. */
export function setupEventosLaminaCantante() {
  document.querySelectorAll('[data-cancao-acao]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const acao = btn.dataset.cancaoAcao;
      if (acao === 'defesa') { abrirCancaoDefesa(); return; }
      if (acao === 'ativar') {
        const r = iniciarCancao(char);
        if (!r.ok) { toast(r.motivo, 'error'); return; }
      } else if (acao === 'encerrar') {
        encerrarCancao(char);
      }
      salvar();
      renderFichaCompleta();
    });
  });
}
