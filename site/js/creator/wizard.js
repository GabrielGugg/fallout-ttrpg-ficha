// ============================================================
// Assistente de criação de personagem (8 passos)
// Segue a ordem da nota "Criação de Personagem": raça, S.P.E.C.I.A.L.,
// antecedente, perícias, talento, traços, equipamento e detalhes.
// ============================================================
import { carregarRegras } from '../db.js';
import { criarPersonagemVazio, salvarPersonagem } from '../store.js';
import { escHtml, mdParaHtml, toast, gerarId } from '../utils.js';
import { gradeCards, ligarCards, popupDetalhe, markdownTraco, abrirSeletorTalento, tabelaPericias, escolherAtributo } from '../ui.js';
import * as R from '../regras-fallout.js';

const PASSOS = ['Raça', 'S.P.E.C.I.A.L.', 'Antecedente', 'Perícias', 'Talento', 'Traços', 'Equipamento', 'Detalhes'];

let regras = null;
let char = null;
let passo = 0;
let raiz = null;

/** Entrada da rota #criar. */
export async function renderCreator(container) {
  raiz = container;
  container.innerHTML = '<div class="carregando">Carregando regras...</div>';
  try {
    regras = await carregarRegras();
  } catch {
    container.innerHTML = '<div class="empty-state"><h2>Não deu para carregar as regras.</h2><p>Confira a conexão e tente de novo.</p></div>';
    return;
  }
  char = criarPersonagemVazio();
  passo = 0;
  desenhar();
}

// ---------------------------------------------------------------- consultas

const racaAtual = () => regras.racas.find(r => r.id === char.raca) || null;
const subtipoAtual = () => racaAtual()?.subtipos.find(s => s.id === char.subtipo) || null;
const antecedenteAtual = () => regras.antecedentes.find(a => a.id === char.antecedente) || null;

/** Pontos de Talento do 1º nível (1, ou 2 com Muitas Estradas Percorridas). */
function pontosNivel1() {
  return R.pontosDeTalento({ ...char, nivel: 1 });
}

/** Escolhas de Ponto de Talento feitas no 1º nível. */
function escolhasNivel1() {
  return char.progressao.filter(p => p.nivel === 1);
}

// ---------------------------------------------------------------- validação

/** Erros que impedem avançar do passo atual. */
function errosDoPasso(i) {
  const erros = [];
  if (i === 0) {
    if (!char.raca) erros.push('Escolha uma raça.');
    if (char.raca === 'robo') {
      if (!char.subtipo) erros.push('Escolha o tipo de robô.');
      const def = R.FERRAMENTAS_ROBO[char.subtipo];
      if (def && char.ferramentas_robo.length !== def.quantidade) {
        erros.push(`Escolha ${def.quantidade === 1 ? 'a ferramenta acoplada' : `as ${def.quantidade} ferramentas acopladas`}.`);
      }
    }
  }
  if (i === 1) erros.push(...R.validarSpecialInicial(char.special));
  if (i === 2) {
    if (!char.antecedente) erros.push('Escolha um antecedente.');
    if (char.antecedente === 'antecedente_personalizado' && char.pericias_antecedente.length !== 3) {
      erros.push('Escolha três perícias para o antecedente personalizado.');
    }
  }
  if (i === 4 && escolhasNivel1().length < pontosNivel1()) erros.push('Use seu Ponto de Talento do 1º nível.');
  if (i === 7 && !char.nome.trim()) erros.push('Dê um nome ao personagem.');
  return erros;
}

// ---------------------------------------------------------------- moldura

/** Desenha o passo atual com a barra de passos e a navegação. */
function desenhar() {
  raiz.innerHTML = `
    <div class="wizard">
      <ol class="wizard-steps">${PASSOS.map((p, i) => `
        <li class="${i === passo ? 'ativo' : i < passo ? 'feito' : ''}"><button type="button" data-ir-passo="${i}" ${i > passo ? 'disabled' : ''}>
          <span class="wizard-num">${i + 1}</span><span class="wizard-label">${p}</span></button></li>`).join('')}
      </ol>
      <section class="wizard-corpo" id="wizard-corpo"></section>
      <nav class="wizard-nav">
        <button class="btn btn-secondary" id="btn-wizard-voltar" ${passo === 0 ? 'disabled' : ''}>Voltar</button>
        <button class="btn btn-primary" id="btn-wizard-proximo">${passo === PASSOS.length - 1 ? 'Criar personagem' : 'Próximo'}</button>
      </nav>
    </div>`;
  raiz.querySelectorAll('[data-ir-passo]').forEach(b => {
    b.onclick = () => { passo = Number(b.dataset.irPasso); desenhar(); };
  });
  raiz.querySelector('#btn-wizard-voltar').onclick = () => { passo--; desenhar(); window.scrollTo(0, 0); };
  raiz.querySelector('#btn-wizard-proximo').onclick = avancar;
  raiz.querySelector('.wizard-steps li.ativo')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const corpo = raiz.querySelector('#wizard-corpo');
  [passoRaca, passoSpecial, passoAntecedente, passoPericias, passoTalento, passoTracos, passoEquipamento, passoDetalhes][passo](corpo);
}

/** Valida e vai para o próximo passo (ou finaliza). */
function avancar() {
  const erros = errosDoPasso(passo);
  if (erros.length) { toast(erros[0], 'erro'); return; }
  if (passo === PASSOS.length - 1) { finalizar(); return; }
  passo++;
  desenhar();
  window.scrollTo(0, 0);
}

/** Redesenha só o corpo do passo (mantém a rolagem). */
function redesenharCorpo() {
  const y = window.scrollY;
  desenhar();
  window.scrollTo(0, y);
}

// ---------------------------------------------------------------- 1. Raça

/** Markdown com os traços de uma raça ou subtipo. */
function markdownTracos(obj) {
  return [obj.descricao, ...obj.tracos.map(t => `***${t.nome}.*** ${t.texto}`)].filter(Boolean).join('\n\n');
}

function passoRaca(el) {
  const raca = racaAtual();
  el.innerHTML = `
    <h2>Escolha sua raça</h2>
    <p class="texto-suave">Toque numa raça para ler os traços.</p>
    ${gradeCards(regras.racas.map(r => ({ id: r.id, titulo: r.nome, selecionado: r.id === char.raca })))}
    <div id="raca-extra"></div>`;
  ligarCards(el, id => {
    const r = regras.racas.find(x => x.id === id);
    popupDetalhe(r.nome, markdownTracos(r), id === char.raca ? null : `Escolher ${r.nome}`, () => {
      char.raca = id;
      char.subtipo = null;
      char.variantes = [];
      char.ferramentas_robo = [];
      char.tracos.personagem = [];
      redesenharCorpo();
    });
  });
  if (!raca) return;
  const extra = el.querySelector('#raca-extra');
  let html = '';
  if (raca.subtipos.length) {
    html += `<h3>Tipo de robô</h3>${gradeCards(raca.subtipos.map(s => ({ id: s.id, titulo: s.nome, selecionado: s.id === char.subtipo })), 'data-subtipo')}`;
  }
  const def = R.FERRAMENTAS_ROBO[char.subtipo];
  if (def) {
    const sub = subtipoAtual();
    const nomes = Object.keys(def.pericias);
    html += `<h3>Ferramentas acopladas <span class="contador">${char.ferramentas_robo.length}/${def.quantidade}</span></h3>
      <p class="texto-suave">${def.quantidade === 1 ? 'Escolha uma ferramenta para o braço.' : 'Escolha uma ferramenta para cada um dos três braços (pode repetir).'}</p>
      <div class="lista-ferramentas">${nomes.map(n => {
        const qtd = char.ferramentas_robo.filter(f => f === n).length;
        const t = sub.tracos.find(x => x.nome === n);
        return `<div class="linha-ferramenta"><button type="button" class="link" data-ferramenta-info="${escHtml(n)}">${escHtml(n)}</button>
          <span class="stepper"><button type="button" data-ferramenta-menos="${escHtml(n)}" ${qtd ? '' : 'disabled'}>−</button><span>${qtd}</span>
          <button type="button" data-ferramenta-mais="${escHtml(n)}" ${char.ferramentas_robo.length >= def.quantidade || (!def.repetir && qtd) || !t ? 'disabled' : ''}>+</button></span></div>`;
      }).join('')}</div>`;
  }
  if (raca.variantes.length) {
    // A variante é um pacote: ou a raça normal, ou todos os traços variantes.
    // O Super Mutante é a exceção: escolhe uma das variantes, que substitui Força Superior.
    const porEscolha = raca.id === 'super_mutante';
    const opcoes = porEscolha
      ? [{ id: '', rotulo: `${raca.nome} normal`, tracos: [] }, ...raca.variantes.map(v => ({ id: v.nome, rotulo: v.nome, tracos: [v] }))]
      : [{ id: '', rotulo: `${raca.nome} normal`, tracos: [] }, { id: 'variante', rotulo: `${raca.nome} variante`, tracos: raca.variantes }];
    const atual = porEscolha ? (char.variantes[0] || '') : (char.variantes.length ? 'variante' : '');
    html += `<h3>Variante <span class="texto-suave">(opcional, se o MJ permitir)</span></h3>
      ${porEscolha ? '<p class="texto-suave">A variante do Super Mutante substitui o traço Força Superior.</p>' : '<p class="texto-suave">A variante vem completa: você ganha todos os traços abaixo.</p>'}
      <div class="lista-check">${opcoes.map(o => `
        <label class="check-card"><input type="radio" name="variante" data-variante="${escHtml(o.id)}" ${o.id === atual ? 'checked' : ''}>
        <span><strong>${escHtml(o.rotulo)}</strong>${o.tracos.map(v => `<br><small><strong>${escHtml(v.nome)}.</strong> ${escHtml(v.texto)}</small>`).join('')}</span></label>`).join('')}</div>`;
  }
  extra.innerHTML = html;
  ligarCards(extra, id => {
    const s = raca.subtipos.find(x => x.id === id);
    popupDetalhe(s.nome, markdownTracos(s), id === char.subtipo ? null : `Escolher ${s.nome}`, () => {
      char.subtipo = id;
      char.ferramentas_robo = [];
      redesenharCorpo();
    });
  }, 'data-subtipo');
  extra.querySelectorAll('[data-ferramenta-info]').forEach(b => {
    b.onclick = () => {
      const t = subtipoAtual().tracos.find(x => x.nome === b.dataset.ferramentaInfo);
      popupDetalhe(t.nome, t.texto);
    };
  });
  extra.querySelectorAll('[data-ferramenta-mais]').forEach(b => {
    b.onclick = () => { char.ferramentas_robo.push(b.dataset.ferramentaMais); redesenharCorpo(); };
  });
  extra.querySelectorAll('[data-ferramenta-menos]').forEach(b => {
    b.onclick = () => {
      const i = char.ferramentas_robo.lastIndexOf(b.dataset.ferramentaMenos);
      if (i >= 0) char.ferramentas_robo.splice(i, 1);
      redesenharCorpo();
    };
  });
  extra.querySelectorAll('[data-variante]').forEach(r => {
    r.onchange = () => {
      const id = r.dataset.variante;
      char.variantes = !id ? [] : id === 'variante' ? raca.variantes.map(v => v.nome) : [id];
      redesenharCorpo();
    };
  });
}

// ---------------------------------------------------------------- 2. SPECIAL

/** Prévia dos valores derivados, atualizada a cada ponto. */
function previaDerivados() {
  const c = { ...char, nivel: 1 };
  const itens = [
    ['PV', R.pvMaximo(c)], ['PE', R.peMaximo(c)], ['PA', R.pontosDeAcao(c)],
    ['Fator de Cura', R.fatorDeCura(c)], ['Carga', R.capacidadeDeCarga(c)],
    ['Sentidos Passivos', R.sentidosPassivos(c)],
  ];
  const lr = R.limiarDeRadiacao(c);
  if (lr != null) itens.push(['Limiar de Radiação', lr]);
  itens.push(['Tampas de Karma', R.tampasDeKarma(c)]);
  return `<div class="stats-row">${itens.map(([n, v]) => `<div class="stat-box"><span class="stat-value">${v}</span><span class="stat-label">${n}</span></div>`).join('')}</div>`;
}

function passoSpecial(el) {
  const resta = R.pontosSpecialRestantes(char.special);
  const efetivo = R.atributosEfetivos({ ...char, progressao: [] });
  el.innerHTML = `
    <h2>Distribua o S.P.E.C.I.A.L.</h2>
    <p class="texto-suave">Todos começam em 5. Você tem 3 pontos e pode diminuir atributos para ganhar mais. Mínimo 1, máximo 10. Modificador = valor − 5.</p>
    <div class="pontos-restantes ${resta === 0 ? 'ok' : resta < 0 ? 'erro' : ''}">Pontos restantes: <strong>${resta}</strong></div>
    <div class="special-lista">${R.ATRIBUTOS.map(a => {
      const v = char.special[a.id];
      const ef = efetivo[a.id];
      return `<div class="special-linha">
        <span class="special-letra">${a.letra}</span>
        <span class="special-nome">${a.nome}</span>
        <span class="stepper"><button type="button" data-special-menos="${a.id}" ${v <= 1 ? 'disabled' : ''}>−</button>
        <span class="special-valor">${v}</span>
        <button type="button" data-special-mais="${a.id}" ${v >= 10 ? 'disabled' : ''}>+</button></span>
        <span class="special-mod">${R.fmtSinal(R.modificador(ef))}${ef !== v ? `<small> (efetivo ${ef})</small>` : ''}</span>
      </div>`;
    }).join('')}</div>
    <h3>Prévia no 1º nível</h3>
    ${previaDerivados()}`;
  el.querySelectorAll('[data-special-mais]').forEach(b => {
    b.onclick = () => { char.special[b.dataset.specialMais]++; redesenharCorpo(); };
  });
  el.querySelectorAll('[data-special-menos]').forEach(b => {
    b.onclick = () => { char.special[b.dataset.specialMenos]--; redesenharCorpo(); };
  });
}

// ---------------------------------------------------------------- 3. Antecedente

const nomePericia = id => R.PERICIAS.find(p => p.id === id)?.nome || id;

function passoAntecedente(el) {
  const atual = antecedenteAtual();
  el.innerHTML = `
    <h2>Escolha seu antecedente</h2>
    <p class="texto-suave">Dá +2 em três perícias, um traço opcional e o equipamento inicial.</p>
    ${gradeCards(regras.antecedentes.map(a => ({
      id: a.id, titulo: a.nome, selecionado: a.id === char.antecedente,
      subtitulo: a.pericias.length ? a.pericias.map(nomePericia).join(', ') : 'Três perícias à escolha',
    })))}
    <div id="ant-extra"></div>`;
  ligarCards(el, id => {
    const a = regras.antecedentes.find(x => x.id === id);
    const md = `**Perícias:** ${a.pericias.length ? a.pericias.map(nomePericia).join(', ') : 'três à escolha'}` +
      (a.traco ? `\n\n**Traço:** ${a.traco}` : '') + `\n\n${a.descricao}`;
    popupDetalhe(a.nome, md, id === char.antecedente ? null : `Escolher ${a.nome}`, () => {
      char.antecedente = id;
      char.pericias_antecedente = [];
      char.tracos.antecedente = null;
      redesenharCorpo();
    });
  });
  if (atual?.id === 'antecedente_personalizado') {
    const extra = el.querySelector('#ant-extra');
    extra.innerHTML = `<h3>Perícias do antecedente <span class="contador">${char.pericias_antecedente.length}/3</span></h3>
      <div class="lista-check colunas">${R.PERICIAS.map(p => `
        <label class="form-check"><input type="checkbox" data-pericia-ant="${p.id}" ${char.pericias_antecedente.includes(p.id) ? 'checked' : ''}
        ${!char.pericias_antecedente.includes(p.id) && char.pericias_antecedente.length >= 3 ? 'disabled' : ''}> ${p.nome}</label>`).join('')}</div>`;
    extra.querySelectorAll('[data-pericia-ant]').forEach(cb => {
      cb.onchange = () => {
        const id = cb.dataset.periciaAnt;
        char.pericias_antecedente = cb.checked ? [...char.pericias_antecedente, id] : char.pericias_antecedente.filter(x => x !== id);
        redesenharCorpo();
      };
    });
  }
}

// ---------------------------------------------------------------- 4. Perícias

function passoPericias(el) {
  el.innerHTML = `
    <h2>Perícias</h2>
    <p class="texto-suave">Bônus = modificador do atributo + metade do modificador de Sorte (arredondado para baixo) + 2 nas perícias do antecedente. Sabotagem, Medicina e Intimidação deixam escolher o atributo.</p>
    ${tabelaPericias(char, antecedenteAtual(), true)}`;
  el.querySelectorAll('[data-atributo-pericia]').forEach(s => {
    s.onchange = () => { char.atributo_pericia[s.dataset.atributoPericia] = s.value; redesenharCorpo(); };
  });
}

// ---------------------------------------------------------------- 5. Talento

function passoTalento(el) {
  const total = pontosNivel1();
  const escolhas = escolhasNivel1();
  el.innerHTML = `
    <h2>Talento do 1º nível</h2>
    <p class="texto-suave">Use ${total === 1 ? 'seu Ponto de Talento' : `seus ${total} Pontos de Talento`} para pegar um talento cujos requisitos você cumpra, ou para aumentar um atributo em 1.</p>
    <div class="escolhas-talento">${escolhas.map((e, i) => `
      <div class="escolha-feita"><span>${e.tipo === 'talento'
        ? `Talento: <button type="button" class="link" data-ver-talento="${escHtml(e.talento)}">${escHtml(regras.talentoPorId[e.talento]?.nome || e.talento)}</button>`
        : `+1 em ${escHtml(R.ATRIBUTOS.find(a => a.id === e.atributo)?.nome)}`}</span>
        <button type="button" class="btn-icon perigo" data-remover-escolha="${i}" aria-label="Remover">✕</button></div>`).join('')}
    </div>
    ${escolhas.length < total ? `<div class="botoes-escolha">
      <button class="btn btn-primary" id="btn-escolher-talento">Escolher talento</button>
      <button class="btn btn-secondary" id="btn-escolher-atributo">+1 em atributo</button></div>` : ''}`;
  el.querySelectorAll('[data-ver-talento]').forEach(b => {
    b.onclick = () => {
      const t = regras.talentoPorId[b.dataset.verTalento];
      popupDetalhe(t.nome, `${t.requisito ? `*Requisito: ${t.requisito}.*\n\n` : ''}${t.texto}`);
    };
  });
  el.querySelectorAll('[data-remover-escolha]').forEach(b => {
    b.onclick = () => {
      const alvo = escolhasNivel1()[Number(b.dataset.removerEscolha)];
      char.progressao = char.progressao.filter(p => p !== alvo);
      redesenharCorpo();
    };
  });
  el.querySelector('#btn-escolher-talento')?.addEventListener('click', () => {
    abrirSeletorTalento({ ...char, nivel: 1 }, regras.talentos, R.talentosEscolhidos(char), id => {
      char.progressao.push({ nivel: 1, tipo: 'talento', talento: id });
      redesenharCorpo();
    });
  });
  el.querySelector('#btn-escolher-atributo')?.addEventListener('click', () => escolherAtributo(char, 1, redesenharCorpo));
}

// ---------------------------------------------------------------- 6. Traços

function passoTracos(el) {
  const ant = antecedenteAtual();
  const tracoAnt = regras.tracos.antecedente.find(t => t.nome === ant?.traco);
  const escolhido = char.tracos.personagem[0];
  const disponiveis = regras.tracos.personagem.map(t => {
    const req = R.cumpreRequisitos(char, t.requisitos);
    return { t, req };
  });
  el.innerHTML = `
    <h2>Traços <span class="texto-suave">(opcional)</span></h2>
    <p class="texto-suave">Traços trazem um benefício e uma penalidade. No 1º nível você pode escolher 1 traço de personagem, além do traço do seu antecedente. <button type="button" class="link" id="btn-ermo-info">O que é Ermo Selvagem?</button></p>
    ${tracoAnt ? `<h3>Traço do antecedente</h3>
      <div class="check-card">
        <label><input type="checkbox" id="chk-traco-ant" ${char.tracos.antecedente ? 'checked' : ''}> <strong>${escHtml(tracoAnt.nome)}</strong></label>
        <button type="button" class="link" data-ver-traco-ant>Ler</button>
        ${char.tracos.antecedente ? `<label class="form-check ermo"><input type="checkbox" id="chk-ermo-ant" ${char.tracos.antecedente.ermo ? 'checked' : ''} ${tracoAnt.ermo_selvagem ? '' : 'disabled'}> Ermo Selvagem</label>` : ''}
      </div>` : ''}
    <h3>Traço de personagem</h3>
    ${escolhido ? `<div class="check-card"><strong>${escHtml(regras.tracos.personagem.find(t => t.id === escolhido.id)?.nome)}</strong>
      <label class="form-check ermo"><input type="checkbox" id="chk-ermo-pers" ${escolhido.ermo ? 'checked' : ''}> Ermo Selvagem</label>
      <button type="button" class="btn-icon perigo" id="btn-remover-traco" aria-label="Remover">✕</button></div>` : ''}
    ${gradeCards(disponiveis.map(({ t, req }) => ({
      id: t.id, titulo: t.nome, subtitulo: t.requisito || '', selecionado: escolhido?.id === t.id,
      bloqueado: !req.ok, motivo: req.ok ? '' : `Requer ${t.requisito}`,
    })))}`;
  el.querySelector('#btn-ermo-info').onclick = () => popupDetalhe('Ermo Selvagem', regras.tracos.ermo_selvagem);
  el.querySelector('[data-ver-traco-ant]')?.addEventListener('click', () => popupDetalhe(tracoAnt.nome, markdownTraco(tracoAnt)));
  el.querySelector('#chk-traco-ant')?.addEventListener('change', e => {
    char.tracos.antecedente = e.target.checked ? { id: tracoAnt.id, ermo: false } : null;
    redesenharCorpo();
  });
  el.querySelector('#chk-ermo-ant')?.addEventListener('change', e => { char.tracos.antecedente.ermo = e.target.checked; });
  el.querySelector('#chk-ermo-pers')?.addEventListener('change', e => { escolhido.ermo = e.target.checked; });
  el.querySelector('#btn-remover-traco')?.addEventListener('click', () => { char.tracos.personagem = []; redesenharCorpo(); });
  ligarCards(el, id => {
    const o = disponiveis.find(x => x.t.id === id);
    popupDetalhe(o.t.nome, markdownTraco(o.t), o.req.ok && escolhido?.id !== id ? 'Escolher este traço' : null, () => {
      char.tracos.personagem = [{ id, ermo: false }];
      redesenharCorpo();
    });
  });
}

// ---------------------------------------------------------------- 7. Equipamento

function passoEquipamento(el) {
  const ant = antecedenteAtual();
  const pacote = R.pacoteDaRaca(ant, char.raca);
  const pacotes = ant?.equipamento || [];
  if (!char.pacote_rotulo || !pacotes.some(p => p.rotulo === char.pacote_rotulo)) char.pacote_rotulo = pacote?.rotulo || null;
  const escolhido = pacotes.find(p => p.rotulo === char.pacote_rotulo);
  el.innerHTML = `
    <h2>Equipamento inicial</h2>
    <label class="check-card"><input type="radio" name="equip" value="antecedente" ${char.equipamento_escolha === 'antecedente' ? 'checked' : ''} ${pacotes.length ? '' : 'disabled'}>
      <span><strong>Pacote do antecedente</strong>${ant?.nota_equipamento ? `<br><small>${escHtml(ant.nota_equipamento)}</small>` : ''}</span></label>
    ${char.equipamento_escolha === 'antecedente' && pacotes.length ? `
      ${pacotes.length > 1 ? `<select class="form-select" id="sel-pacote">${pacotes.map(p => `<option ${p.rotulo === char.pacote_rotulo ? 'selected' : ''}>${escHtml(p.rotulo)}</option>`).join('')}</select>` : ''}
      <div class="info-box">${mdParaHtml(escolhido?.itens || '')}</div>` : ''}
    <label class="check-card"><input type="radio" name="equip" value="tampinhas" ${char.equipamento_escolha === 'tampinhas' ? 'checked' : ''}>
      <span><strong>${R.TAMPINHAS_SEM_EQUIPAMENTO} tampinhas</strong><br><small>Comece sem itens e compre o que quiser no inventário da ficha.</small></span></label>`;
  el.querySelectorAll('input[name="equip"]').forEach(r => {
    r.onchange = () => { char.equipamento_escolha = r.value; redesenharCorpo(); };
  });
  el.querySelector('#sel-pacote')?.addEventListener('change', e => { char.pacote_rotulo = e.target.value; redesenharCorpo(); });
}

// ---------------------------------------------------------------- 8. Detalhes

function passoDetalhes(el) {
  const d = char.detalhes;
  el.innerHTML = `
    <h2>Detalhes</h2>
    <div class="form-group"><label class="form-label" for="det-nome">Nome *</label><input class="form-input" id="det-nome" value="${escHtml(char.nome)}" maxlength="60"></div>
    <div class="form-group"><label class="form-label" for="det-jogador">Jogador</label><input class="form-input" id="det-jogador" value="${escHtml(d.jogador)}"></div>
    <div class="form-group"><label class="form-label" for="det-idade">Idade</label><input class="form-input" id="det-idade" value="${escHtml(d.idade)}"></div>
    <div class="form-group"><label class="form-label" for="det-aparencia">Aparência</label><textarea class="form-textarea" id="det-aparencia" rows="2">${escHtml(d.aparencia)}</textarea></div>
    <div class="form-group"><label class="form-label" for="det-personalidade">Personalidade</label><textarea class="form-textarea" id="det-personalidade" rows="2">${escHtml(d.personalidade)}</textarea></div>
    <div class="form-group"><label class="form-label" for="det-historia">História</label><textarea class="form-textarea" id="det-historia" rows="4">${escHtml(d.historia)}</textarea></div>`;
  el.querySelector('#det-nome').oninput = e => { char.nome = e.target.value; };
  for (const campo of ['jogador', 'idade', 'aparencia', 'personalidade', 'historia']) {
    el.querySelector(`#det-${campo}`).oninput = e => { d[campo] = e.target.value; };
  }
}

// ---------------------------------------------------------------- finalizar

/** Monta o inventário inicial, enche PV/PE e salva. */
function finalizar() {
  const ant = antecedenteAtual();
  char.inventario = [];
  char.tampinhas = 0;
  if (char.equipamento_escolha === 'tampinhas' || !ant?.equipamento?.length) {
    char.tampinhas = R.TAMPINHAS_SEM_EQUIPAMENTO;
  } else {
    const pacote = ant.equipamento.find(p => p.rotulo === char.pacote_rotulo) || R.pacoteDaRaca(ant, char.raca);
    const { linhas, tampinhas } = R.interpretarPacote(pacote.itens, regras.itens);
    char.tampinhas = tampinhas;
    let vestiu = false;
    char.inventario = linhas.map(l => {
      const item = regras.catalogo[l.ref];
      const armadura = item?.categoria === 'Armaduras' && !item.subcategoria;
      const equipado = armadura && !vestiu;
      if (equipado) vestiu = true;
      return {
        id: gerarId(), ref: l.ref, nome: item && item.nome.toLowerCase() === l.nome.toLowerCase() ? item.nome : l.nome,
        qtd: l.qtd, equipado, desgaste: l.desgaste || 0,
      };
    });
  }
  char.nivel = 1;
  char.pv_atual = R.pvMaximo(char);
  char.pe_atual = R.peMaximo(char);
  const salvo = salvarPersonagem(char);
  toast('Personagem criado!', 'sucesso');
  window.navegar(`ficha/${salvo.id}`);
}
