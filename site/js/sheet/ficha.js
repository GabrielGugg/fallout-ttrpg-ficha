// ============================================================
// Ficha do personagem na mesa
// ============================================================
import { carregarRegras } from '../db.js';
import { getPersonagem, salvarPersonagem, exportar } from '../store.js';
import { escHtml, mdParaHtml, abrirModal, fecharModal, toast, baixarArquivo } from '../utils.js';
import { popupDetalhe, markdownTalento, markdownTraco, tabelaPericias, gradeCards, ligarCards } from '../ui.js';
import { definirTitulo } from '../app.js';
import { secaoInventario, ligarInventario } from './inventario.js';
import { abrirSubidaDeNivel, secaoPontosPericia, ligarPontosPericia } from './nivel.js';
import * as R from '../regras-fallout.js';

let regras = null;
let char = null;
let raiz = null;

const NOMES_RACA = {
  humano: 'Humano', necrotico: 'Necrótico', sintetico: 'Sintético Gen 2', robo: 'Robô', super_mutante: 'Super Mutante',
};

/** Entrada da rota #ficha/<id>. */
export async function renderSheet(container, id) {
  raiz = container;
  container.innerHTML = '<div class="carregando">Carregando ficha...</div>';
  char = getPersonagem(id);
  if (!char) {
    container.innerHTML = '<div class="empty-state"><h2>Personagem não encontrado</h2><button class="btn btn-primary" onclick="navegar(\'home\')">Voltar</button></div>';
    return;
  }
  try {
    regras = await carregarRegras();
  } catch {
    container.innerHTML = '<div class="empty-state"><h2>Não deu para carregar as regras.</h2></div>';
    return;
  }
  definirTitulo(char.nome || 'Ficha');
  desenhar();
}

/** Contexto compartilhado com os módulos de seção (inventário, nível). */
export function contexto() {
  return { char, regras, salvar, redesenhar: desenhar, antecedente: antecedente() };
}

/** Salva o personagem atual. */
function salvar() {
  salvarPersonagem(char);
}

const antecedente = () => regras.antecedentes.find(a => a.id === char.antecedente) || null;
const raca = () => regras.racas.find(r => r.id === char.raca) || null;
const subtipo = () => raca()?.subtipos.find(s => s.id === char.subtipo) || null;

/** Garante PV/PE atuais dentro do máximo (o máximo muda com nível e atributos). */
function normalizarRecursos() {
  const pvMax = R.pvMaximo(char);
  const peMax = R.peMaximo(char);
  if (char.pv_atual == null || char.pv_atual > pvMax) char.pv_atual = Math.min(char.pv_atual ?? pvMax, pvMax);
  if (char.pe_atual == null || char.pe_atual > peMax) char.pe_atual = Math.min(char.pe_atual ?? peMax, peMax);
}

// ---------------------------------------------------------------- desenho

/** Desenha a ficha inteira, mantendo a rolagem e os blocos abertos. */
function desenhar() {
  const y = window.scrollY;
  const abertos = new Set([...raiz.querySelectorAll('details[data-details-id][open]')].map(d => d.dataset.detailsId));
  normalizarRecursos();
  const ant = antecedente();
  raiz.innerHTML = `
    <div class="ficha">
      ${secaoCabecalho(ant)}
      ${secaoRecursos()}
      ${secaoSpecial()}
      ${secaoDerivados()}
      ${secaoAtaques(ant)}
      ${bloco('pericias', 'Perícias', tabelaPericias(char, ant, true) + secaoPontosPericia(contexto()))}
      ${bloco('sobrevivencia', 'Sobrevivência e condições', secaoSobrevivencia())}
      ${bloco('talentos', 'Talentos e traços', secaoTalentosTracos())}
      ${bloco('raca', `Traços de ${escHtml(NOMES_RACA[char.raca] || 'raça')}`, secaoRaca())}
      ${bloco('inventario', 'Inventário', secaoInventario(contexto()))}
      ${bloco('detalhes', 'Detalhes e notas', secaoDetalhes())}
      <div class="ficha-rodape">
        <button class="btn btn-secondary" id="btn-exportar-ficha">Exportar ficha (JSON)</button>
      </div>
    </div>`;
  abertos.forEach(id => raiz.querySelector(`details[data-details-id="${id}"]`)?.setAttribute('open', ''));
  ligarEventos();
  window.scrollTo(0, y);
}

/** Bloco recolhível que nasce fechado. */
function bloco(id, titulo, conteudo) {
  return `<details class="card bloco" data-details-id="${id}"><summary class="card-header">${titulo}</summary><div class="card-corpo">${conteudo}</div></details>`;
}

function secaoCabecalho(ant) {
  const proximo = R.xpDoNivel(char.nivel + 1);
  const podeSubir = char.nivel < R.NIVEL_MAXIMO && (char.xp || 0) >= proximo;
  return `
    <div class="card cabecalho">
      <div class="cab-linha">
        <div>
          <div class="cab-nome">${escHtml(char.nome)}</div>
          <div class="cab-sub">${escHtml(NOMES_RACA[char.raca] || '')}${subtipo() ? ` (${escHtml(subtipo().nome)})` : ''} · ${escHtml(ant?.nome || '')}</div>
        </div>
        <div class="cab-nivel"><span>Nível</span><strong>${char.nivel}</strong></div>
      </div>
      <div class="cab-xp">
        <label>XP <input type="number" class="mini-input" id="input-xp" min="0" step="50" value="${char.xp || 0}"></label>
        <span class="texto-suave">próximo nível: ${proximo}</span>
        <button class="btn ${podeSubir ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btn-subir-nivel" ${char.nivel >= R.NIVEL_MAXIMO ? 'disabled' : ''}>Subir de nível</button>
      </div>
    </div>`;
}

function secaoRecursos() {
  const pvMax = R.pvMaximo(char);
  const peMax = R.peMaximo(char);
  const karma = R.tampasDeKarma(char);
  const morrendo = char.pv_atual === 0;
  return `
    <div class="card recursos">
      <div class="recurso-barras">
        ${barra('PV', 'Pontos de Vida', char.pv_atual, pvMax, char.pv_temp, 'pv')}
        ${barra('PE', 'Pontos de Estamina', char.pe_atual, peMax, char.pe_temp, 'pe')}
      </div>
      <div class="recurso-botoes">
        <button class="btn btn-danger" id="btn-dano">Sofrer dano</button>
        <button class="btn btn-success" id="btn-cura">Curar</button>
        <button class="btn btn-secondary" id="btn-descanso">Descansar</button>
      </div>
      <div class="stats-row">
        <div class="stat-box"><span class="stat-value">${R.pontosDeAcao(char)}</span><span class="stat-label">Pontos de Ação</span></div>
        <div class="stat-box karma"><span class="stat-label">Tampas de Karma</span>
          <span class="tampas">${Array.from({ length: karma }, (_, i) => `<button type="button" class="tampa${i < (char.karma_viradas || 0) ? ' virada' : ''}" data-tampa="${i}" aria-label="Tampa ${i + 1}">${i < (char.karma_viradas || 0) ? '✦' : '◎'}</button>`).join('')}</span></div>
      </div>
      ${morrendo ? secaoSuspiros() : ''}
    </div>`;
}

/** Barra de PV ou PE com o valor temporário ao lado. */
function barra(sigla, nome, atual, max, temp, chave) {
  const pct = max ? Math.max(0, Math.min(100, (atual / max) * 100)) : 0;
  return `<div class="barra-recurso ${chave}">
    <div class="barra-topo"><span class="barra-nome">${nome}</span>
      <span class="barra-valor"><strong>${atual}</strong>/${max}${temp ? ` <span class="temp">+${temp} temp.</span>` : ''}</span></div>
    <div class="barra"><div class="barra-preench" style="width:${pct}%"></div></div>
    <div class="barra-ajuste"><button type="button" data-ajuste="${chave}" data-delta="-1" aria-label="${sigla} −1">−</button>
      <button type="button" data-ajuste="${chave}" data-delta="1" aria-label="${sigla} +1">+</button>
      <button type="button" class="link" data-temp="${chave}">temporários</button></div>
  </div>`;
}

/** Suspiros Finais, mostrados quando o personagem está morrendo. */
function secaoSuspiros() {
  const s = char.suspiros || { sucessos: 0, falhas: 0 };
  const limite = R.falhasParaMorrer(char);
  const bolhas = (n, total, tipo) => Array.from({ length: total }, (_, i) =>
    `<button type="button" class="bolha ${tipo}${i < n ? ' marcada' : ''}" data-suspiro="${tipo}" data-indice="${i}"></button>`).join('');
  return `<div class="suspiros">
    <strong>Morrendo · Suspiros Finais</strong> <span class="texto-suave">(2 PA, CD 10, d20 + mod. de Sorte ou Resistência + Moral da Equipe)</span>
    <div>Sucessos ${bolhas(s.sucessos, 3, 'sucesso')}</div>
    <div>Falhas ${bolhas(s.falhas, limite, 'falha')}</div>
    ${s.falhas >= limite ? '<p class="aviso">Seu personagem morreu.</p>' : s.sucessos >= 3 ? '<p class="ok">Estabilizou: recupere 1 PV.</p>' : ''}
  </div>`;
}

function secaoSpecial() {
  const v = R.atributosEfetivos(char);
  return `<div class="card special-card">${R.ATRIBUTOS.map(a => `
    <button type="button" class="atributo-box" data-ver-atributo="${a.id}">
      <span class="atributo-letra">${a.letra}</span>
      <span class="atributo-valor">${v[a.id]}</span>
      <span class="atributo-mod">${R.fmtSinal(R.modificador(v[a.id]))}</span>
      <span class="atributo-nome">${a.nome}</span>
    </button>`).join('')}</div>`;
}

function secaoDerivados() {
  const d = R.defesas(char, regras.catalogo);
  const lr = R.limiarDeRadiacao(char);
  const carga = R.cargaTotal(char, regras.catalogo);
  const cap = R.capacidadeDeCarga(char);
  const itens = [
    ['DF', d.df, d.armadura ? `Defesa (${d.armadura})` : 'Defesa'],
    ['TD', d.td, 'Tolerância a Dano'],
    ['FC', R.fatorDeCura(char), 'Fator de Cura'],
    ['SP', R.sentidosPassivos(char), 'Sentidos Passivos'],
    ['INI', 10 + R.modificadores(char).PER, 'Iniciativa passiva'],
  ];
  if (lr != null) itens.push(['LR', lr, 'Limiar de Radiação']);
  return `<div class="card"><div class="stats-row">${itens.map(([s, v, n]) => `
    <div class="stat-box"><span class="stat-value">${v}</span><span class="stat-label">${n}</span></div>`).join('')}
    <div class="stat-box ${carga > cap ? 'alerta' : ''}"><span class="stat-value">${carga}<small>/${cap}</small></span><span class="stat-label">Carga</span></div>
  </div></div>`;
}

/** Ataques: armas equipadas, ferramentas de robô e o ataque desarmado. */
function secaoAtaques(ant) {
  const linhas = [];
  for (const l of char.inventario || []) {
    const item = regras.catalogo[l.ref];
    if (!l.equipado || !R.periciaDaArma(item)) continue;
    linhas.push({ nome: l.nome, a: R.calcularAtaque(char, item, ant), extra: item.campos['Propriedades Especiais'] || '' });
  }
  const sub = subtipo();
  for (const nome of char.ferramentas_robo || []) {
    const t = sub?.tracos.find(x => x.nome === nome);
    const a = t && R.ataqueDaFerramenta(char, nome, t.texto, ant);
    if (a) linhas.push({ nome: `${nome} (acoplada)`, a, extra: '' });
  }
  const mods = R.modificadores(char);
  linhas.push({
    nome: 'Desarmado',
    a: { acerto: R.bonusPericia(char, 'pugilismo', ant), dano: '1d4 contusão', bonusDano: Math.max(mods.FOR, mods.AGI), pa: '', critico: '20, dano dobrado' },
    extra: 'Pode ser não letal.',
  });
  return `<div class="card"><div class="card-header">Ataques</div><div class="ataques">${linhas.map(({ nome, a, extra }) => `
    <div class="ataque">
      <div class="ataque-nome">${escHtml(nome)}${a.desvantagemForca ? ' <span class="badge badge-warning" title="Força abaixo do requisito">desvantagem</span>' : ''}</div>
      <div class="ataque-dados">
        <span><small>Acerto</small><strong>${R.fmtSinal(a.acerto)}</strong></span>
        <span><small>Dano</small><strong>${escHtml(a.dano)}${a.bonusDano ? ` ${a.bonusDano > 0 ? '+' : '−'} ${Math.abs(a.bonusDano)}` : ''}</strong></span>
        ${a.pa ? `<span><small>Custo</small><strong>${escHtml(a.pa)}</strong></span>` : ''}
        ${a.alcance ? `<span><small>Alcance</small><strong>${a.alcance.normal}/${a.alcance.longo} pés</strong></span>` : ''}
        ${a.critico ? `<span><small>Crítico</small><strong>${escHtml(a.critico)}</strong></span>` : ''}
      </div>
      ${extra ? `<div class="ataque-extra">${escHtml(extra)}</div>` : ''}
    </div>`).join('')}</div>
    <p class="texto-suave">Equipe armas no inventário para que apareçam aqui.</p></div>`;
}

function secaoSobrevivencia() {
  const contadores = [['fome', 'Fome'], ['desidratacao', 'Desidratação'], ['exaustao', 'Exaustão'], ['radiacao', 'Radiação']];
  const imuneRad = ['necrotico', 'sintetico', 'robo', 'super_mutante'].includes(char.raca);
  return `
    <div class="contadores">${contadores.map(([k, n]) => `
      <div class="contador-linha"><button type="button" class="link" data-ver-condicao="${k}">${n}</button>
        <span class="stepper"><button type="button" data-contador="${k}" data-delta="-1" ${char[k] ? '' : 'disabled'}>−</button><span>${char[k] || 0}</span>
        <button type="button" data-contador="${k}" data-delta="1" ${k === 'radiacao' && imuneRad ? 'disabled title="Sua raça não ganha níveis de radiação"' : ''}>+</button></span></div>`).join('')}
    </div>
    <h4>Condições</h4>
    <div class="chips">${(char.condicoes || []).map((c, i) => `<span class="chip"><button type="button" class="link" data-ver-condicao-id="${escHtml(c)}">${escHtml(regras.condicoes.find(x => x.id === c)?.nome || c)}</button>
      <button type="button" class="chip-x" data-remover-condicao="${i}" aria-label="Remover">✕</button></span>`).join('') || '<span class="texto-suave">Nenhuma.</span>'}</div>
    <button class="btn btn-secondary btn-sm" id="btn-add-condicao">+ Condição</button>`;
}

function secaoTalentosTracos() {
  const talentos = (char.progressao || []).map((p, i) => ({ p, i })).filter(({ p }) => p.tipo === 'talento');
  const aumentos = (char.progressao || []).filter(p => p.tipo === 'atributo');
  const tracos = [
    ...(char.tracos?.personagem || []).map(t => ({ ...t, lista: regras.tracos.personagem })),
    ...(char.tracos?.antecedente ? [{ ...char.tracos.antecedente, lista: regras.tracos.antecedente }] : []),
  ];
  return `
    <h4>Talentos</h4>
    ${talentos.length ? gradeCards(talentos.map(({ p, i }) => ({
      id: String(i), titulo: regras.talentoPorId[p.talento]?.nome || p.talento, subtitulo: `Nível ${p.nivel}`,
    })), 'data-ver-talento-idx') : '<p class="texto-suave">Nenhum talento.</p>'}
    ${aumentos.length ? `<p class="texto-suave">Pontos de Talento em atributos: ${aumentos.map(a => `${a.atributo} (nível ${a.nivel})`).join(', ')}</p>` : ''}
    <h4>Traços</h4>
    ${tracos.length ? gradeCards(tracos.map((t, i) => ({
      id: String(i), titulo: t.lista.find(x => x.id === t.id)?.nome || t.id, subtitulo: t.ermo ? 'Ermo Selvagem' : '',
    })), 'data-ver-traco-idx') : '<p class="texto-suave">Nenhum traço.</p>'}`;
}

function secaoRaca() {
  const r = raca();
  if (!r) return '';
  const lista = [...r.tracos.filter(t => !['Idade', 'Tamanho'].includes(t.nome)),
    ...r.variantes.filter(v => (char.variantes || []).includes(v.nome)).map(v => ({ ...v, nome: `${v.nome} (variante)` })),
    ...(subtipo()?.tracos || []).filter(t => !R.FERRAMENTAS_ROBO[char.subtipo]?.pericias.hasOwnProperty(t.nome) || (char.ferramentas_robo || []).includes(t.nome))];
  return `<div class="md-content">${lista.map(t => mdParaHtml(`***${t.nome}.*** ${t.texto}`)).join('')}</div>`;
}

function secaoDetalhes() {
  const d = char.detalhes || {};
  const campo = (k, n, linhas) => `<div class="form-group"><label class="form-label" for="det-${k}">${n}</label>
    <textarea class="form-textarea" id="det-${k}" data-detalhe="${k}" rows="${linhas}">${escHtml(d[k] || '')}</textarea></div>`;
  return `
    <div class="form-group"><label class="form-label" for="det-nome-ficha">Nome</label><input class="form-input" id="det-nome-ficha" value="${escHtml(char.nome)}"></div>
    ${campo('jogador', 'Jogador', 1)}${campo('idade', 'Idade', 1)}${campo('aparencia', 'Aparência', 2)}
    ${campo('personalidade', 'Personalidade', 2)}${campo('historia', 'História', 4)}
    <div class="form-group"><label class="form-label" for="det-notas">Notas</label><textarea class="form-textarea" id="det-notas" rows="5">${escHtml(char.notas || '')}</textarea></div>`;
}

// ---------------------------------------------------------------- eventos

/** Liga todos os eventos da ficha (chamado a cada desenho). */
function ligarEventos() {
  const $ = s => raiz.querySelector(s);
  const $$ = s => raiz.querySelectorAll(s);

  $('#input-xp').onchange = e => { char.xp = Math.max(0, Number(e.target.value) || 0); salvar(); desenhar(); };
  $('#btn-subir-nivel').onclick = () => abrirSubidaDeNivel(contexto());
  $('#btn-dano').onclick = abrirDano;
  $('#btn-cura').onclick = abrirCura;
  $('#btn-descanso').onclick = abrirDescanso;
  $('#btn-exportar-ficha').onclick = () => {
    baixarArquivo(new Blob([exportar(char.id)], { type: 'application/json' }), `${(char.nome || 'personagem').replace(/[^\w-]+/g, '_')}.json`);
  };

  $$('[data-ajuste]').forEach(b => {
    b.onclick = () => {
      const chave = b.dataset.ajuste === 'pv' ? 'pv_atual' : 'pe_atual';
      const max = b.dataset.ajuste === 'pv' ? R.pvMaximo(char) : R.peMaximo(char);
      char[chave] = Math.max(0, Math.min(max, char[chave] + Number(b.dataset.delta)));
      if (chave === 'pv_atual' && char.pv_atual > 0) char.suspiros = { sucessos: 0, falhas: 0 };
      salvar(); desenhar();
    };
  });
  $$('[data-temp]').forEach(b => {
    b.onclick = () => {
      const chave = b.dataset.temp === 'pv' ? 'pv_temp' : 'pe_temp';
      abrirModal(b.dataset.temp === 'pv' ? 'PV temporários' : 'PE temporários', `
        <p class="texto-suave">Temporários não somam: se ganhar mais, fique com o maior. Somem num descanso de 1 hora.</p>
        <input type="number" class="form-input" id="input-temp" min="0" value="${char[chave] || 0}">`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-ok-temp">Salvar</button>');
      document.getElementById('btn-ok-temp').onclick = () => {
        char[chave] = Math.max(0, Number(document.getElementById('input-temp').value) || 0);
        fecharModal(); salvar(); desenhar();
      };
    };
  });
  $$('[data-tampa]').forEach(b => {
    b.onclick = () => {
      const i = Number(b.dataset.tampa);
      char.karma_viradas = i < (char.karma_viradas || 0) ? i : i + 1;
      salvar(); desenhar();
    };
  });
  $$('[data-suspiro]').forEach(b => {
    b.onclick = () => {
      const tipo = b.dataset.suspiro === 'sucesso' ? 'sucessos' : 'falhas';
      const i = Number(b.dataset.indice);
      char.suspiros = char.suspiros || { sucessos: 0, falhas: 0 };
      char.suspiros[tipo] = i < char.suspiros[tipo] ? i : i + 1;
      salvar(); desenhar();
    };
  });
  $$('[data-ver-atributo]').forEach(b => {
    b.onclick = () => {
      const a = R.ATRIBUTOS.find(x => x.id === b.dataset.verAtributo);
      const base = char.special[a.id];
      const ef = R.atributosEfetivos(char)[a.id];
      const pericias = R.PERICIAS.filter(p => R.atributoDaPericia(char, p.id) === a.id).map(p => p.nome);
      popupDetalhe(a.nome, `**Valor:** ${ef} (distribuição inicial ${base})\n\n**Modificador:** ${R.fmtSinal(R.modificador(ef))}\n\n**Perícias:** ${pericias.join(', ') || 'nenhuma'}`);
    };
  });
  $$('[data-atributo-pericia]').forEach(s => {
    s.onchange = () => { char.atributo_pericia = { ...(char.atributo_pericia || {}), [s.dataset.atributoPericia]: s.value }; salvar(); desenhar(); };
  });
  $$('[data-contador]').forEach(b => {
    b.onclick = () => {
      const k = b.dataset.contador;
      char[k] = Math.max(0, (char[k] || 0) + Number(b.dataset.delta));
      salvar(); desenhar();
    };
  });
  $$('[data-ver-condicao]').forEach(b => {
    b.onclick = () => {
      const nome = { fome: 'Fome', desidratacao: 'Desidratação', exaustao: 'Exaustão', radiacao: 'Radiação ou Rads' }[b.dataset.verCondicao];
      const c = regras.condicoes.find(x => x.nome === nome);
      if (c) popupDetalhe(c.nome, c.texto);
    };
  });
  $$('[data-ver-condicao-id]').forEach(b => {
    b.onclick = () => {
      const c = regras.condicoes.find(x => x.id === b.dataset.verCondicaoId);
      if (c) popupDetalhe(c.nome, c.texto);
    };
  });
  $$('[data-remover-condicao]').forEach(b => {
    b.onclick = () => { char.condicoes.splice(Number(b.dataset.removerCondicao), 1); salvar(); desenhar(); };
  });
  $('#btn-add-condicao').onclick = abrirCondicoes;
  ligarCards(raiz, idx => {
    const p = char.progressao[Number(idx)];
    const t = regras.talentoPorId[p.talento];
    if (t) popupDetalhe(t.nome, markdownTalento(t));
  }, 'data-ver-talento-idx');
  ligarCards(raiz, idx => {
    const lista = [...(char.tracos?.personagem || []).map(t => ({ ...t, l: regras.tracos.personagem })),
      ...(char.tracos?.antecedente ? [{ ...char.tracos.antecedente, l: regras.tracos.antecedente }] : [])];
    const t = lista[Number(idx)];
    const def = t?.l.find(x => x.id === t.id);
    if (def) popupDetalhe(def.nome + (t.ermo ? ' (Ermo Selvagem)' : ''), markdownTraco(def));
  }, 'data-ver-traco-idx');

  $('#det-nome-ficha').onchange = e => { char.nome = e.target.value.trim() || char.nome; salvar(); definirTitulo(char.nome); };
  $$('[data-detalhe]').forEach(t => {
    t.onchange = () => { char.detalhes = { ...(char.detalhes || {}), [t.dataset.detalhe]: t.value }; salvar(); };
  });
  $('#det-notas').onchange = e => { char.notas = e.target.value; salvar(); };

  ligarInventario(raiz, contexto());
  ligarPontosPericia(raiz, contexto());
}

// ---------------------------------------------------------------- modais

/** Modal de dano: aplica a Ordem do Dano com a TD atual. */
function abrirDano() {
  const { td } = R.defesas(char, regras.catalogo);
  abrirModal('Sofrer dano', `
    <div class="form-group"><label class="form-label" for="input-dano">Dano</label><input type="number" class="form-input" id="input-dano" min="0" inputmode="numeric"></div>
    <label class="form-check"><input type="checkbox" id="chk-direto"> Direto nos PV (inconsciente ou sem perceber o ataque)</label>
    <label class="form-check"><input type="checkbox" id="chk-resist"> Tenho resistência a este dano</label>
    <label class="form-check"><input type="checkbox" id="chk-vuln"> Sou vulnerável a este dano</label>
    <p class="texto-suave">Ordem: PE temporários, PE, resistência ou vulnerabilidade, TD (${td}), PV temporários, PV.</p>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-ok-dano">Aplicar</button>');
  document.getElementById('input-dano').focus();
  document.getElementById('btn-ok-dano').onclick = () => {
    const dano = Number(document.getElementById('input-dano').value) || 0;
    const r = R.aplicarDano({ pe_temp: char.pe_temp || 0, pe: char.pe_atual, pv_temp: char.pv_temp || 0, pv: char.pv_atual }, dano, {
      td, direto: document.getElementById('chk-direto').checked,
      resistente: document.getElementById('chk-resist').checked, vulneravel: document.getElementById('chk-vuln').checked,
    });
    const jaMorrendo = char.pv_atual === 0;
    Object.assign(char, { pe_temp: r.pe_temp, pe_atual: r.pe, pv_temp: r.pv_temp, pv_atual: r.pv });
    fecharModal();
    const pvMax = R.pvMaximo(char);
    if (jaMorrendo && dano > 0) {
      char.suspiros = { ...(char.suspiros || { sucessos: 0 }), falhas: (char.suspiros?.falhas || 0) + 1 };
      toast(dano >= pvMax ? 'Dano igual ou maior que o máximo de PV a 0 PV: morte instantânea.' : 'Dano com 0 PV: uma falha em Suspiro Final.', 'erro');
    } else if (r.chegouAZero) {
      char.suspiros = { sucessos: 0, falhas: 0 };
      const msg = dano >= 3 * pvMax ? 'Dano massivo: morte instantânea.'
        : r.sobra >= pvMax ? 'Chegou a 0 PV com ferimento grave (sobra ≥ máximo de PV).' : 'Chegou a 0 PV: condição morrendo.';
      toast(msg, 'erro');
    }
    salvar(); desenhar();
  };
}

/** Modal de cura: PV (ou PE) até o máximo. */
function abrirCura() {
  abrirModal('Curar', `
    <div class="form-group"><label class="form-label" for="input-cura">Quantidade</label><input type="number" class="form-input" id="input-cura" min="0" inputmode="numeric"></div>
    <div class="botoes-rapidos"><button type="button" class="btn btn-secondary btn-sm" id="btn-cura-fc">Fator de Cura (${R.fatorDeCura(char)})</button></div>
    <label class="form-check"><input type="radio" name="alvo-cura" value="pv" checked> Pontos de Vida</label>
    <label class="form-check"><input type="radio" name="alvo-cura" value="pe"> Pontos de Estamina</label>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-success" id="btn-ok-cura">Curar</button>');
  document.getElementById('btn-cura-fc').onclick = () => { document.getElementById('input-cura').value = R.fatorDeCura(char); };
  document.getElementById('btn-ok-cura').onclick = () => {
    const n = Math.max(0, Number(document.getElementById('input-cura').value) || 0);
    if (document.querySelector('input[name="alvo-cura"]:checked').value === 'pv') {
      char.pv_atual = Math.min(R.pvMaximo(char), char.pv_atual + n);
      if (char.pv_atual > 0) char.suspiros = { sucessos: 0, falhas: 0 };
    } else {
      char.pe_atual = Math.min(R.peMaximo(char), char.pe_atual + n);
    }
    fecharModal(); salvar(); desenhar();
  };
}

/** Modal de descanso (regras de O Ambiente, ainda não traduzidas). */
function abrirDescanso() {
  const maquina = R.descansaComoMaquina(char);
  abrirModal('Descansar', `
    <label class="check-card"><input type="radio" name="tipo-desc" value="curto" checked>
      <span><strong>1 hora</strong><br><small>${maquina ? 'PE cheios.' : 'PE voltam até a metade do máximo.'} Temporários somem.</small></span></label>
    <label class="check-card"><input type="radio" name="tipo-desc" value="longo">
      <span><strong>${maquina ? '2 horas' : '6 horas'}</strong><br><small>Recupera PV pelo Fator de Cura${maquina ? ' (com INT ou PER no lugar de RES)' : ''}, −1 Exaustão${maquina ? ' e PE cheios' : ', PE cheios se dormir confortável'}.</small></span></label>
    ${maquina ? '' : '<label class="form-check"><input type="checkbox" id="chk-confortavel" checked> Dormiu confortável (abrigo e superfície macia)</label>'}
    <p class="texto-suave">Regras do capítulo O Ambiente, ainda na versão em inglês do livro.</p>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-ok-desc">Descansar</button>');
  document.getElementById('btn-ok-desc').onclick = () => {
    const tipo = document.querySelector('input[name="tipo-desc"]:checked').value;
    const confortavel = maquina || document.getElementById('chk-confortavel').checked;
    Object.assign(char, R.efeitoDescanso(char, tipo, confortavel));
    if (char.pv_atual > 0) char.suspiros = { sucessos: 0, falhas: 0 };
    fecharModal(); salvar(); desenhar();
    toast('Descanso aplicado.', 'sucesso');
  };
}

/** Seletor de condições. */
function abrirCondicoes() {
  const ocultas = ['Fome', 'Desidratação', 'Exaustão', 'Radiação ou Rads'];
  const lista = regras.condicoes.filter(c => !ocultas.includes(c.nome));
  abrirModal('Adicionar condição', gradeCards(lista.map(c => ({ id: c.id, titulo: c.nome, selecionado: (char.condicoes || []).includes(c.id) }))),
    '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>');
  ligarCards(document.getElementById('modal-corpo'), id => {
    const c = lista.find(x => x.id === id);
    const tem = (char.condicoes || []).includes(id);
    popupDetalhe(c.nome, c.texto, tem ? null : 'Adicionar', () => {
      char.condicoes = [...(char.condicoes || []), id];
      fecharModal(); salvar(); desenhar();
    });
  });
}
