// ============================================================
// Subida de nível e distribuição de Pontos de Perícia
// ============================================================
import { escHtml, abrirModal, fecharModal, toast } from '../utils.js';
import { abrirSeletorTalento, popupDetalhe, markdownTalento } from '../ui.js';
import * as R from '../regras-fallout.js';

/**
 * Assistente de subida de nível: mostra o que o novo nível concede (Ponto de
 * Talento, PV e PE nos níveis ímpares, Pontos de Perícia) e pede a escolha do
 * Ponto de Talento. Ao confirmar, sobe o nível e soma aos PV/PE atuais o que
 * o máximo aumentou.
 */
export function abrirSubidaDeNivel(ctx) {
  const { char, regras, salvar, redesenhar } = ctx;
  const novo = char.nivel + 1;
  const xpNec = R.xpDoNivel(novo);
  const escolha = { tipo: null, talento: null, atributo: null };

  const simulado = () => {
    const c = { ...char, nivel: novo, progressao: [...char.progressao] };
    if (escolha.tipo) c.progressao.push({ nivel: novo, ...escolha });
    return c;
  };

  const desenhar = () => {
    const c = simulado();
    const ganhaTalento = R.ganhaTalentoNoNivel(novo);
    const dPv = R.pvMaximo(c) - R.pvMaximo(char);
    const dPe = R.peMaximo(c) - R.peMaximo(char);
    const dPericia = R.pontosDePericiaTotais(c) - R.pontosDePericiaTotais(char);
    const corpo = `
      ${(char.xp || 0) < xpNec ? `<p class="aviso">Você tem ${char.xp || 0} XP e o nível ${novo} pede ${xpNec}. Se o MJ liberou, pode subir assim mesmo: o XP vai para ${xpNec}.</p>` : ''}
      <h3>Nível ${novo} concede</h3>
      <ul class="lista-ganhos">
        <li>PV máximo: ${R.pvMaximo(char)} → <strong>${R.pvMaximo(c)}</strong>${dPv ? ` (+${dPv})` : ' (sobe só nos níveis ímpares)'}</li>
        <li>PE máximo: ${R.peMaximo(char)} → <strong>${R.peMaximo(c)}</strong>${dPe ? ` (+${dPe})` : ''}</li>
        ${dPericia ? `<li><strong>${dPericia} Pontos de Perícia</strong> para distribuir na seção Perícias</li>` : ''}
        <li>Fator de Cura: ${R.fatorDeCura(char)} → <strong>${R.fatorDeCura(c)}</strong></li>
        <li>${ganhaTalento ? '<strong>1 Ponto de Talento</strong>' : 'Sem Ponto de Talento neste nível'}</li>
      </ul>
      ${ganhaTalento ? `
        <h3>Ponto de Talento</h3>
        ${escolha.tipo === 'talento' ? `<p>Talento: <button type="button" class="link" id="nv-ver-talento">${escHtml(regras.talentoPorId[escolha.talento]?.nome)}</button></p>`
          : escolha.tipo === 'atributo' ? `<p>+1 em ${escHtml(R.ATRIBUTOS.find(a => a.id === escolha.atributo)?.nome)}</p>` : ''}
        <div class="botoes-escolha">
          <button type="button" class="btn btn-secondary btn-sm" id="nv-talento">${escolha.tipo === 'talento' ? 'Trocar talento' : 'Escolher talento'}</button>
          <button type="button" class="btn btn-secondary btn-sm" id="nv-atributo">+1 em atributo</button>
        </div>
        <div id="nv-atributos" class="opcao-grid" hidden>${R.ATRIBUTOS.map(a => {
          const v = R.atributosEfetivos(char)[a.id];
          return `<button type="button" class="opcao-card" data-nv-atributo="${a.id}" ${v >= 10 ? 'disabled' : ''}><span class="opcao-titulo">${a.nome}</span><span class="opcao-sub">${v} → ${Math.min(10, v + 1)}</span></button>`;
        }).join('')}</div>` : ''}`;
    document.getElementById('modal-corpo').innerHTML = corpo;
    document.getElementById('nv-talento')?.addEventListener('click', () => {
      abrirSeletorTalento({ ...char, nivel: novo }, regras.talentos, R.talentosEscolhidos(char), id => {
        Object.assign(escolha, { tipo: 'talento', talento: id, atributo: null });
        desenhar();
      });
    });
    document.getElementById('nv-ver-talento')?.addEventListener('click', () => {
      const t = regras.talentoPorId[escolha.talento];
      popupDetalhe(t.nome, markdownTalento(t));
    });
    document.getElementById('nv-atributo')?.addEventListener('click', () => {
      document.getElementById('nv-atributos').hidden = false;
    });
    document.querySelectorAll('[data-nv-atributo]').forEach(b => {
      b.onclick = () => { Object.assign(escolha, { tipo: 'atributo', atributo: b.dataset.nvAtributo, talento: null }); desenhar(); };
    });
  };

  abrirModal(`Subir para o nível ${novo}`, '',
    `${char.nivel > 1 ? '<button class="btn btn-secondary" id="nv-desfazer">Voltar um nível</button>' : ''}
     <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-primary" id="nv-confirmar">Subir de nível</button>`);
  desenhar();

  document.getElementById('nv-confirmar').onclick = () => {
    if (R.ganhaTalentoNoNivel(novo) && !escolha.tipo) { toast('Use o Ponto de Talento deste nível.', 'erro'); return; }
    const pvAntes = R.pvMaximo(char);
    const peAntes = R.peMaximo(char);
    char.nivel = novo;
    char.xp = Math.max(char.xp || 0, xpNec);
    if (escolha.tipo) char.progressao.push({ nivel: novo, tipo: escolha.tipo, ...(escolha.tipo === 'talento' ? { talento: escolha.talento } : { atributo: escolha.atributo }) });
    char.pv_atual = Math.max(0, (char.pv_atual ?? pvAntes) + R.pvMaximo(char) - pvAntes);
    char.pe_atual = Math.max(0, (char.pe_atual ?? peAntes) + R.peMaximo(char) - peAntes);
    fecharModal(); salvar(); redesenhar();
    toast(`Nível ${novo}!`, 'sucesso');
  };
  document.getElementById('nv-desfazer')?.addEventListener('click', () => {
    abrirModal('Voltar um nível', `<p>Voltar do nível ${char.nivel} para o ${char.nivel - 1}? A escolha de Ponto de Talento do nível ${char.nivel} é desfeita. O XP não muda.</p>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="nv-ok-desfazer">Voltar</button>');
    document.getElementById('nv-ok-desfazer').onclick = () => {
      char.progressao = char.progressao.filter(p => p.nivel !== char.nivel);
      char.nivel--;
      // Pontos de perícia acima do novo total são devolvidos do fim para o começo.
      let excesso = R.pontosDePericiaGastos(char) - R.pontosDePericiaTotais(char);
      for (const id of Object.keys(char.pontos_pericia || {}).reverse()) {
        while (excesso > 0 && char.pontos_pericia[id] > 0) { char.pontos_pericia[id]--; excesso--; }
      }
      char.pv_atual = Math.min(char.pv_atual, R.pvMaximo(char));
      char.pe_atual = Math.min(char.pe_atual, R.peMaximo(char));
      fecharModal(); fecharModal(); salvar(); redesenhar();
    };
  });
}

/** Distribuição de Pontos de Perícia (só aparece quando há pontos no nível). */
export function secaoPontosPericia({ char }) {
  const total = R.pontosDePericiaTotais(char);
  if (!total) return '<p class="texto-suave">Pontos de Perícia começam no nível 5.</p>';
  const gastos = R.pontosDePericiaGastos(char);
  return `<div class="pontos-pericia">
    <h4>Pontos de Perícia <span class="contador ${gastos > total ? 'erro' : ''}">${gastos}/${total}</span></h4>
    <div class="lista-pontos">${R.PERICIAS.map(p => {
      const n = char.pontos_pericia?.[p.id] || 0;
      return `<div class="contador-linha"><span>${p.nome}</span><span class="stepper">
        <button type="button" data-ponto-pericia="${p.id}" data-delta="-1" ${n ? '' : 'disabled'}>−</button><span>${n}</span>
        <button type="button" data-ponto-pericia="${p.id}" data-delta="1" ${gastos >= total ? 'disabled' : ''}>+</button></span></div>`;
    }).join('')}</div></div>`;
}

/** Liga os botões de Pontos de Perícia. */
export function ligarPontosPericia(raiz, { char, salvar, redesenhar }) {
  raiz.querySelectorAll('[data-ponto-pericia]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.pontoPericia;
      char.pontos_pericia = { ...(char.pontos_pericia || {}) };
      char.pontos_pericia[id] = Math.max(0, (char.pontos_pericia[id] || 0) + Number(b.dataset.delta));
      salvar(); redesenhar();
    };
  });
}
