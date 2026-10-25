// ============================================================
// Componentes de interface reaproveitados pelo criador e pela ficha
// ============================================================
import { escHtml, mdParaHtml, abrirModal, fecharModal, semAcento } from './utils.js';
import * as R from './regras-fallout.js';
const { cumpreRequisitos } = R;

/**
 * Grade de cards. Cada opção: { id, titulo, subtitulo?, selecionado?, bloqueado?, motivo? }.
 * Clicar no card chama aoClicar(id); quem chama decide se abre popup ou seleciona.
 */
export function gradeCards(opcoes, attr = 'data-card-id') {
  return `<div class="opcao-grid">${opcoes.map(o => `
    <button type="button" class="opcao-card${o.selecionado ? ' selecionado' : ''}${o.bloqueado ? ' bloqueado' : ''}" ${attr}="${escHtml(o.id)}">
      <span class="opcao-titulo">${escHtml(o.titulo)}</span>
      ${o.subtitulo ? `<span class="opcao-sub">${escHtml(o.subtitulo)}</span>` : ''}
      ${o.bloqueado && o.motivo ? `<span class="opcao-motivo">${escHtml(o.motivo)}</span>` : ''}
    </button>`).join('')}</div>`;
}

/** Liga o clique dos cards de uma grade. */
export function ligarCards(raiz, aoClicar, attr = 'data-card-id') {
  raiz.querySelectorAll(`[${attr}]`).forEach(el => {
    el.onclick = () => aoClicar(el.getAttribute(attr));
  });
}

/**
 * Popup com descrição em Markdown e um botão de confirmação opcional.
 * rotuloOk null = só fechar.
 */
export function popupDetalhe(titulo, markdown, rotuloOk = null, aoConfirmar = null, extraHtml = '') {
  abrirModal(titulo, `<div class="md-content">${mdParaHtml(markdown)}</div>${extraHtml}`,
    `<button class="btn btn-secondary" onclick="fecharModal()">${rotuloOk ? 'Cancelar' : 'Fechar'}</button>` +
    (rotuloOk ? `<button class="btn btn-primary" id="btn-popup-ok">${escHtml(rotuloOk)}</button>` : ''));
  if (rotuloOk) {
    document.getElementById('btn-popup-ok').onclick = () => {
      fecharModal();
      aoConfirmar?.();
    };
  }
}

/** Texto em Markdown de um talento (requisito + regra). */
export function markdownTalento(t) {
  return `${t.requisito ? `*Requisito: ${t.requisito}.*\n\n` : ''}${t.texto}`;
}

/** Texto em Markdown de um traço (requisito + regra + Ermo Selvagem). */
export function markdownTraco(t) {
  return `${t.requisito ? `*Pré-requisito: ${t.requisito}.*\n\n` : ''}${t.texto}` +
    (t.ermo_selvagem ? `\n\n**Ermo Selvagem:** ${t.ermo_selvagem}` : '');
}

/**
 * Seletor de talento: busca, filtro por grupo e "só os que cumpro".
 * Talentos sem requisito cumprido aparecem travados, com o motivo.
 * aoEscolher(idTalento) é chamado ao confirmar no popup.
 */
export function abrirSeletorTalento(char, talentos, jaTem, aoEscolher) {
  const grupos = [...new Set(talentos.map(t => t.grupo))];
  const estado = { busca: '', grupo: '', soDisponiveis: true };
  abrirModal('Escolher talento', `
    <div class="filtros">
      <input class="form-input" id="talento-busca" placeholder="Buscar talento...">
      <select class="form-select" id="talento-grupo"><option value="">Todos os grupos</option>
        ${grupos.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('')}</select>
      <label class="form-check"><input type="checkbox" id="talento-disp" checked> Só os que eu cumpro</label>
      <p class="texto-suave">Talentos com requisito especial (membro perdido, cegueira) aparecem ao desmarcar o filtro.</p>
    </div>
    <div id="talento-lista"></div>`, '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>');

  const desenhar = () => {
    const q = semAcento(estado.busca);
    const opcoes = talentos.filter(t => (!estado.grupo || t.grupo === estado.grupo) &&
      (!q || semAcento(t.nome).includes(q) || semAcento(t.texto).includes(q)))
      .map(t => {
        const req = cumpreRequisitos(char, t.requisitos);
        const repetivel = /Repetição/.test(t.texto);
        const repetido = jaTem.includes(t.id) && !repetivel;
        return { t, req, bloqueado: !req.ok || repetido, motivo: repetido ? 'Já escolhido' : req.faltando.length ? `Falta: ${req.faltando.join(', ')}` : '' };
      })
      .filter(o => !estado.soDisponiveis || (!o.bloqueado && !o.req.especial));
    const lista = document.getElementById('talento-lista');
    lista.innerHTML = opcoes.length ? gradeCards(opcoes.map(o => ({
      id: o.t.id, titulo: o.t.nome, subtitulo: `${o.t.grupo}${o.t.requisito ? ' · ' + o.t.requisito : ''}`,
      bloqueado: o.bloqueado, motivo: o.motivo,
    }))) : '<p class="texto-suave">Nenhum talento encontrado.</p>';
    ligarCards(lista, id => {
      const o = opcoes.find(x => x.t.id === id);
      const aviso = o.req.especial ? `<p class="aviso">Requisito especial: ${escHtml(o.req.especial)}. Confira com o MJ.</p>` : '';
      popupDetalhe(o.t.nome, markdownTalento(o.t), o.bloqueado ? null : 'Escolher este talento', () => {
        fecharModal();
        aoEscolher(id);
      }, aviso);
    });
  };
  document.getElementById('talento-busca').oninput = e => { estado.busca = e.target.value; desenhar(); };
  document.getElementById('talento-grupo').onchange = e => { estado.grupo = e.target.value; desenhar(); };
  document.getElementById('talento-disp').onchange = e => { estado.soDisponiveis = e.target.checked; desenhar(); };
  desenhar();
}

/** Tabela de perícias com a origem do bônus e a escolha de atributo. */
export function tabelaPericias(c, antecedente, editavel) {
  return `<div class="pericias-lista">${R.PERICIAS.map(p => {
    const d = R.detalharPericia(c, p.id, antecedente);
    const titulo = d.partes.map(x => `${x.rotulo} ${R.fmtSinal(x.valor)}`).join(' · ');
    const seletor = p.atributos.length > 1 && editavel
      ? `<select class="mini-select" data-atributo-pericia="${p.id}">${p.atributos.map(a => `<option value="${a}" ${a === d.atributo ? 'selected' : ''}>${a}</option>`).join('')}</select>`
      : `<span class="pericia-atributo">${d.atributo}</span>`;
    const doAnt = R.periciasDoAntecedente(c, antecedente).includes(p.id);
    return `<div class="pericia-item${doAnt ? ' destaque' : ''}" title="${escHtml(titulo)}">
      <span class="pericia-nome">${p.nome}</span>${seletor}<span class="pericia-bonus">${R.fmtSinal(d.total)}</span>
      <span class="pericia-origem">${escHtml(titulo)}</span></div>`;
  }).join('')}</div>`;
}

/** Popup para gastar um Ponto de Talento em +1 num atributo (até 10). */
export function escolherAtributo(c, nivel, depois) {
  const v = R.atributosEfetivos(c);
  popupDetalhe('Aumentar atributo', 'Escolha o atributo que sobe 1 ponto (máximo 10).', null, null,
    `<div class="opcao-grid">${R.ATRIBUTOS.map(a => `<button type="button" class="opcao-card" data-subir-atributo="${a.id}" ${v[a.id] >= 10 ? 'disabled' : ''}>
      <span class="opcao-titulo">${a.nome}</span><span class="opcao-sub">${v[a.id]} → ${Math.min(10, v[a.id] + 1)}</span></button>`).join('')}</div>`);
  document.querySelectorAll('[data-subir-atributo]').forEach(b => {
    b.onclick = () => {
      c.progressao.push({ nivel, tipo: 'atributo', atributo: b.dataset.subirAtributo });
      window.fecharModal();
      depois();
    };
  });
}

/** Expressão que acha o nome da propriedade no texto, aceitando masculino e feminino (Automático/Automática). */
function regexPropriedade(nome) {
  const esc = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const corpo = /[oa]$/i.test(nome) ? esc.slice(0, -1) + '[oa]' : esc;
  return new RegExp(`(?<![\\p{L}])${corpo}(?![\\p{L}])`, 'giu');
}

/**
 * Escapa o texto e marca cada propriedade de item conhecida com uma dica:
 * passar o mouse mostra a regra; tocar (celular) abre o popup.
 */
export function realcarPropriedades(texto, propriedades = []) {
  let html = escHtml(texto);
  const marcas = [];
  const ordenadas = [...propriedades].sort((a, b) => b.nome.length - a.nome.length);
  for (const p of ordenadas) {
    const base = p.nome.replace(/\s*\(.*?\)$/, '').replace(/:.*$/, '').trim();
    html = html.replace(regexPropriedade(base), achado => {
      marcas.push(`<button type="button" class="prop-tip" data-prop="${escHtml(p.nome)}" data-tip="${escHtml(p.texto)}">${achado}</button>`);
      return `\u0000${marcas.length - 1}\u0000`;
    });
  }
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => marcas[Number(i)]);
}

/** Liga o toque nas dicas de propriedade (abre popup com a regra). */
export function ligarPropriedades(raiz, propriedades = []) {
  raiz.querySelectorAll('.prop-tip').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      const p = propriedades.find(x => x.nome === b.dataset.prop);
      if (p) popupDetalhe(p.nome, p.texto);
    };
  });
}
