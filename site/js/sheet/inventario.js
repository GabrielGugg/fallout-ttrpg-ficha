// ============================================================
// Inventário: carga, itens, tampinhas, vestir/equipar, desgaste,
// melhorias de armadura, modificações de arma e compra do catálogo
// ============================================================
import { escHtml, mdParaHtml, abrirModal, fecharModal, toast, gerarId, semAcento } from '../utils.js';
import * as R from '../regras-fallout.js';
import { realcarPropriedades, ligarPropriedades, popupDetalhe } from '../ui.js';

/** Rótulo da caixa de equipar conforme o tipo de item. */
const ROTULO_EQUIPAR = { armadura: 'Vestida', arma: 'Equipada', vestivel: 'Vestido' };

/** Custo em tampinhas de um item do catálogo (null se não tiver). */
export function custoDoItem(item) {
  const campo = item?.campos?.['Custo Base'] ?? item?.campos?.Custo;
  const m = String(campo || '').replace(/\./g, '').match(/(\d+)\s*tp/);
  return m ? Number(m[1]) : null;
}

/** Carga com uma casa decimal e vírgula. */
const fmtCarga = n => String(Math.round(n * 10) / 10).replace('.', ',');

/** Nome de uma melhoria de armadura pelo id curto. */
function nomeMelhoria(regras, id) {
  return regras.catalogo[`melhorias_de_armadura_${id}`]?.nome || id;
}

/** Resumo de uma linha: efeitos e avisos que aparecem embaixo do nome. */
function resumoDaLinha(l, item, { regras }) {
  const efeitos = [];
  const avisos = [];
  const tipo = R.tipoEquipavel(item);
  if (tipo === 'armadura') {
    const est = R.estatisticasDaArmadura(l, item, regras.catalogo);
    efeitos.push(`DF ${est.df} · TD ${est.td}${est.forca != null ? ` · FOR ${est.forca}` : ''}`);
    const mel = R.melhoriasDaArmadura(l, item);
    if (mel.length) efeitos.push(mel.map(m => `${nomeMelhoria(regras, m.id)} ${m.nivel}`).join(', '));
    if (est.perdaDesgaste) avisos.push(`desgaste: DF e TD −${est.perdaDesgaste}`);
  } else if (tipo === 'arma') {
    const est = R.estatisticasDaArma(l, item, regras.catalogo);
    if (est.mods.length) efeitos.push(est.mods.map(m => m.nome).join(', '));
    if (est.desgaste) avisos.push(`desgaste: ataque −${est.desgaste}`);
    if (est.excedeu) avisos.push(`modificações demais (${est.espacos.usados}/${est.espacos.max}): a arma não funciona`);
    if (l.na_bolsa && R.cabeNaBolsaDeArmas(item)) efeitos.push('na Bolsa de Armas');
  } else if (tipo === 'vestivel' && l.equipado) {
    efeitos.push(...R.efeitosDoVestivel(item));
  }
  if ((l.desgaste || 0) >= 10) avisos.push('quebrado');
  return { efeitos, avisos };
}

/** Card de carga: atual/máximo, barra, de onde vem o máximo e avisos. */
function cartaoCarga({ char, regras }) {
  const e = R.estadoDeCarga(char, regras.catalogo);
  const pct = e.maximo ? Math.min(100, (e.atual / e.maximo) * 100) : 100;
  const situacao = e.muitoSobrecarregado ? 'Muito sobrecarregado' : e.sobrecarregado ? 'Sobrecarregado' : null;
  return `<div class="card carga-card${e.sobrecarregado ? ' alerta' : ''}">
    <div class="carga-topo"><span class="card-header">Carga</span>
      <span class="carga-valor">${fmtCarga(e.atual)}<small> / ${e.maximo}</small></span></div>
    <div class="barra"><div class="barra-preench" style="width:${pct}%"></div></div>
    ${situacao ? `<p class="aviso"><button type="button" class="link" data-ver-sobrecarga="${situacao}">${situacao}</button>${e.muitoSobrecarregado ? ' (acima do dobro do máximo)' : ''}.</p>` : ''}
    <h4>Capacidade máxima</h4>
    <ul class="carga-partes">${e.partes.map(p => `<li><span>${escHtml(p.rotulo)}</span><strong>${p.valor >= 0 ? '+' : '−'}${Math.abs(p.valor)}</strong></li>`).join('')}
      <li><span><strong>Total</strong></span><strong>${e.maximo}</strong></li></ul>
    ${e.avisos.map(a => `<p class="texto-suave">⚠ ${escHtml(a)}</p>`).join('')}
    <label class="carga-outros">Outros bônus
      <input type="number" class="mini-input" id="input-ajuste-carga" step="5" value="${Number(char.ajuste_carga) || 0}">
      <small>Rato de Carga de outro personagem (+10 cada), comida Substanciosa (+50 por 6 horas)...</small></label>
  </div>`;
}

/** HTML da aba de inventário: card de carga e card dos itens. */
export function secaoInventario(ctx) {
  const { char, regras } = ctx;
  const linhas = char.inventario || [];
  return `${cartaoCarga(ctx)}
    <div class="card">
    <div class="tampinhas-linha">
      <span>Tampinhas: <strong>${char.tampinhas || 0}</strong></span>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-tampinhas">Ajustar</button>
    </div>
    <div class="inv-lista">${linhas.length ? linhas.map(l => {
      const item = regras.catalogo[l.ref];
      const tipo = R.tipoEquipavel(item);
      const { efeitos, avisos } = resumoDaLinha(l, item, ctx);
      return `<div class="inv-item${l.equipado ? ' equipado' : ''}">
        <button type="button" class="inv-nome link" data-inv-ver="${escHtml(l.id)}">${escHtml(l.nome)}</button>
        <span class="inv-meta">${item ? escHtml(item.subcategoria || item.categoria) : 'Item livre'} · carga ${fmtCarga(R.cargaDaLinha(char, l, regras.catalogo))}${l.desgaste ? ` · desgaste ${l.desgaste}` : ''}
          ${efeitos.length ? `<span class="inv-efeitos">${escHtml(efeitos.join(' · '))}</span>` : ''}
          ${avisos.length ? `<span class="inv-avisos">${escHtml(avisos.join(' · '))}</span>` : ''}</span>
        <span class="inv-controles">
          ${tipo ? `<label class="form-check"><input type="checkbox" data-inv-equipar="${escHtml(l.id)}" ${l.equipado ? 'checked' : ''}> ${ROTULO_EQUIPAR[tipo]}</label>` : ''}
          <span class="stepper"><button type="button" data-inv-qtd="${escHtml(l.id)}" data-delta="-1" aria-label="Quantidade −1">−</button><span>${l.qtd || 1}</span>
          <button type="button" data-inv-qtd="${escHtml(l.id)}" data-delta="1" aria-label="Quantidade +1">+</button></span>
        </span>
      </div>`;
    }).join('') : '<p class="texto-suave">Inventário vazio.</p>'}</div>
    <div class="botoes-escolha">
      <button type="button" class="btn btn-primary btn-sm" id="btn-add-catalogo">+ Do catálogo</button>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-add-livre">+ Item livre</button>
    </div>
    </div>`;
}

/** Liga os eventos da aba de inventário. */
export function ligarInventario(raiz, ctx) {
  const { char, regras, salvar, redesenhar } = ctx;
  const achar = id => char.inventario.find(l => l.id === id);

  raiz.querySelector('#input-ajuste-carga')?.addEventListener('change', e => {
    char.ajuste_carga = Number(e.target.value) || 0;
    salvar(); redesenhar();
  });
  raiz.querySelector('[data-ver-sobrecarga]')?.addEventListener('click', e => {
    const c = regras.condicoes.find(x => x.nome.toLowerCase() === e.currentTarget.dataset.verSobrecarga.toLowerCase());
    if (c) popupDetalhe(c.nome, c.texto);
  });

  raiz.querySelector('#btn-tampinhas')?.addEventListener('click', () => {
    abrirModal('Tampinhas', `
      <p>Atual: <strong>${char.tampinhas || 0}</strong></p>
      <div class="form-group"><label class="form-label" for="input-tp">Ganhar ou gastar (use − para gastar)</label>
      <input type="number" class="form-input" id="input-tp" inputmode="numeric"></div>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-ok-tp">Aplicar</button>');
    document.getElementById('btn-ok-tp').onclick = () => {
      char.tampinhas = Math.max(0, (char.tampinhas || 0) + (Number(document.getElementById('input-tp').value) || 0));
      fecharModal(); salvar(); redesenhar();
    };
  });

  raiz.querySelectorAll('[data-inv-equipar]').forEach(cb => {
    cb.onchange = () => {
      const l = achar(cb.dataset.invEquipar);
      const item = regras.catalogo[l.ref];
      // Só uma armadura vestida por vez.
      if (cb.checked && R.ehArmadura(item)) {
        char.inventario.forEach(o => { if (o !== l && R.ehArmadura(regras.catalogo[o.ref])) o.equipado = false; });
      }
      l.equipado = cb.checked;
      salvar(); redesenhar();
    };
  });

  raiz.querySelectorAll('[data-inv-qtd]').forEach(b => {
    b.onclick = () => {
      const l = achar(b.dataset.invQtd);
      const nova = (l.qtd || 1) + Number(b.dataset.delta);
      if (nova <= 0) {
        abrirModal('Remover item', `<p>Remover <strong>${escHtml(l.nome)}</strong> do inventário?</p>`,
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-ok-rem">Remover</button>');
        document.getElementById('btn-ok-rem').onclick = () => {
          char.inventario = char.inventario.filter(o => o !== l);
          fecharModal(); salvar(); redesenhar();
        };
        return;
      }
      l.qtd = nova;
      salvar(); redesenhar();
    };
  });

  raiz.querySelectorAll('[data-inv-ver]').forEach(b => {
    b.onclick = () => abrirDetalheLinha(achar(b.dataset.invVer), ctx);
  });

  raiz.querySelector('#btn-add-catalogo')?.addEventListener('click', () => abrirCatalogo(ctx));
  raiz.querySelector('#btn-add-livre')?.addEventListener('click', () => {
    abrirModal('Item livre', `
      <div class="form-group"><label class="form-label" for="livre-nome">Nome</label><input class="form-input" id="livre-nome"></div>
      <div class="form-group"><label class="form-label" for="livre-qtd">Quantidade</label><input type="number" class="form-input" id="livre-qtd" value="1" min="1"></div>
      <div class="form-group"><label class="form-label" for="livre-carga">Carga (cada)</label><input type="number" class="form-input" id="livre-carga" value="0" min="0" step="0.5"></div>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-ok-livre">Adicionar</button>');
    document.getElementById('btn-ok-livre').onclick = () => {
      const nome = document.getElementById('livre-nome').value.trim();
      if (!nome) { toast('Dê um nome ao item.', 'erro'); return; }
      char.inventario.push({ id: gerarId(), ref: null, nome, qtd: Math.max(1, Number(document.getElementById('livre-qtd').value) || 1),
        carga: Number(document.getElementById('livre-carga').value) || 0, equipado: false, desgaste: 0 });
      fecharModal(); salvar(); redesenhar();
    };
  });
}

/** Descrição (das notas) e tabela com os campos de um item; propriedades ganham dica com a regra. */
function camposHtml(item, propriedades) {
  return `${item.descricao ? `<div class="md-content">${mdParaHtml(item.descricao)}</div>` : ''}
    <table class="tabela-campos">${Object.entries(item.campos).filter(([k, v]) => v && v !== item.nome)
    .map(([k, v]) => `<tr><th>${escHtml(k.replace(/ \d+$/, ''))}</th><td>${/Propriedades|Efeito|Descrição|Nível/.test(k) ? realcarPropriedades(v, propriedades) : escHtml(v)}</td></tr>`).join('')}</table>`;
}

/** Controle de desgaste: − N/10 + e a regra de como o item ganha desgaste. */
function desgasteHtml(l, item) {
  const n = l.desgaste || 0;
  const regra = R.regraDeDesgaste(item);
  return `<div class="form-group desgaste-bloco">
    <span class="form-label">Níveis de Desgaste</span>
    <div class="desgaste-ctrl">
      <span class="stepper"><button type="button" data-desgaste="-1" ${n ? '' : 'disabled'} aria-label="Desgaste −1">−</button><span>${n}<small>/10</small></span>
      <button type="button" data-desgaste="1" ${n >= 10 ? 'disabled' : ''} aria-label="Desgaste +1">+</button></span>
      <button type="button" class="prop-tip" id="btn-regra-desgaste" data-tip="${escHtml(regra)}">Como ganha desgaste?</button>
    </div>
    <p class="texto-suave" id="regra-desgaste" hidden>${escHtml(regra)}</p>
  </div>`;
}

/** Melhorias da armadura: embutidas, instaladas (com nível) e o seletor para instalar. */
function melhoriasHtml(l, item, regras) {
  const est = R.estatisticasDaArmadura(l, item, regras.catalogo);
  const esp = R.espacosDaArmadura(l, item, regras.catalogo);
  const todas = R.melhoriasDaArmadura(l, item);
  const usadas = new Set(todas.map(m => m.id));
  const livres = regras.itens.filter(i => i.subcategoria === 'Melhorias de Armadura' && !usadas.has(R.idMelhoria(i)));
  const texto = (id, nivel) => {
    const c = regras.catalogo[`melhorias_de_armadura_${id}`]?.campos || {};
    return [1, 2, 3].filter(n => n <= nivel).map(n => c[`Nível ${n}`]).filter(t => t && t !== '—').join(' ');
  };
  const embutidas = todas.filter(m => m.embutida).length;
  return `<h4>Armadura</h4>
    <p>DF <strong>${est.df}</strong> · TD <strong>${est.td}</strong> · carga ${fmtCarga(est.carga)}${l.equipado ? ' (metade vestida)' : ''}${est.forca != null ? ` · FOR ${est.forca}` : ''}</p>
    <h4>Melhorias <small>(${esp.usados}/${esp.total} espaços)</small></h4>
    <ul class="instalados">${todas.map((m, i) => `
      <li><span><strong>${escHtml(nomeMelhoria(regras, m.id))}</strong> nível ${m.nivel}${m.embutida ? ' <small>(embutida)</small>' : ''}<br>
        <span class="texto-suave">${escHtml(texto(m.id, m.nivel))}</span></span>
        ${m.embutida ? '' : `<span class="stepper"><button type="button" data-mel-nivel="${i - embutidas}" data-delta="-1" aria-label="Nível −1">−</button><span>${m.nivel}</span>
          <button type="button" data-mel-nivel="${i - embutidas}" data-delta="1" ${m.nivel >= 3 ? 'disabled' : ''} aria-label="Nível +1">+</button></span>`}</li>`).join('') || '<li class="texto-suave">Nenhuma.</li>'}
    </ul>
    ${esp.usados < esp.total && livres.length ? `<div class="inst-add">
      <select class="form-select" id="sel-melhoria">${livres.map(i => `<option value="${escHtml(R.idMelhoria(i))}">${escHtml(i.nome)} (${escHtml(i.campos['Custo Base'] || '')})</option>`).join('')}</select>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-add-melhoria">Instalar</button></div>` : ''}
    <p class="texto-suave">Uma melhoria de cada tipo por armadura; os níveis não ocupam espaço. DF, TD, LR, carga, Força, PE e PA já entram na ficha; o resto fica no texto.</p>`;
}

/** Modificações da arma: instaladas, espaços e o seletor das compatíveis. */
function modsHtml(l, item, regras) {
  const est = R.estatisticasDaArma(l, item, regras.catalogo);
  const compat = R.modsCompativeis(item, regras.itens).filter(m => !(l.mods || []).includes(m.id));
  const porQtd = est.espacos.tipo === 'quantidade';
  const limite = porQtd ? `${est.espacos.usados}/1 modificação` : `${est.espacos.usados}/6 espaços`;
  return `<h4>Arma</h4>
    <p>Acerto ${R.fmtSinal(est.acerto)} <small>(modificações ${R.fmtSinal(est.bonusMods)}, desgaste −${est.desgaste})</small>
      · carga ${fmtCarga(est.carga)}${est.forca != null ? ` · FOR ${est.forca}` : ''}${est.pa != null ? ` · ${est.pa} PA` : ''}${est.pente ? ` · +${est.pente} balas no pente` : ''}</p>
    <h4>Modificações <small>(${limite})</small></h4>
    ${est.excedeu ? '<p class="aviso">Espaços de modificação acima do limite: a arma deixa de funcionar.</p>' : ''}
    <ul class="instalados">${est.mods.map(m => `
      <li><span><strong>${escHtml(m.nome)}</strong>${!porQtd ? ` <small>(${R.espacosDaMod(m)} ${R.espacosDaMod(m) === 1 ? 'espaço' : 'espaços'})</small>` : ''}<br>
        <span class="texto-suave">${escHtml(String(m.campos['Descrição'] || '').replace(/\*\*Espaços: \d+\.\*\*\s*/, ''))}</span></span>
        <button type="button" class="btn-icon perigo" data-mod-remover="${escHtml(m.id)}" aria-label="Remover ${escHtml(m.nome)}">✕</button></li>`).join('') || '<li class="texto-suave">Nenhuma.</li>'}
    </ul>
    ${(!porQtd || est.espacos.usados < 1) && compat.length ? `<div class="inst-add">
      <select class="form-select" id="sel-mod">${compat.map(m => `<option value="${escHtml(m.id)}">${escHtml(m.nome)}${!porQtd ? ` (${R.espacosDaMod(m)} esp.)` : ''}</option>`).join('')}</select>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-add-mod">Instalar</button></div>
      <p class="texto-suave">Confira na descrição se a modificação serve nesta arma. Acerto, carga, Força, PA e pente já entram na ficha.</p>` : ''}
    ${R.cabeNaBolsaDeArmas(item) ? `<label class="form-check"><input type="checkbox" id="chk-na-bolsa" ${l.na_bolsa ? 'checked' : ''}>
      Guardada na Bolsa de Armas (metade da carga enquanto a bolsa estiver vestida)</label>` : ''}`;
}

/**
 * Popup de uma linha do inventário. Tudo é salvo na hora: desgaste,
 * melhorias, modificações, notas e carga do item livre.
 */
function abrirDetalheLinha(l, ctx) {
  const { regras, salvar, redesenhar } = ctx;
  const item = regras.catalogo[l.ref];
  const tipo = R.tipoEquipavel(item);

  const corpo = () => `
    ${item ? camposHtml(item, regras.propriedades) : '<p class="texto-suave">Item livre, fora do catálogo.</p>'}
    ${tipo === 'vestivel' ? `<p class="texto-suave">Vestido: ${escHtml(R.efeitosDoVestivel(item).join(' · ') || 'sem efeito na ficha')}.</p>` : ''}
    ${tipo === 'armadura' ? melhoriasHtml(l, item, regras) : ''}
    ${tipo === 'arma' && R.periciaDaArma(item) !== 'explosivos' ? modsHtml(l, item, regras) : ''}
    ${desgasteHtml(l, item)}
    ${!item ? `<div class="form-group"><label class="form-label" for="det-carga">Carga (cada)</label>
      <input type="number" class="form-input" id="det-carga" min="0" step="0.5" value="${l.carga || 0}"></div>` : ''}
    <div class="form-group"><label class="form-label" for="det-nota">Notas</label>
      <textarea class="form-textarea" id="det-nota" rows="2">${escHtml(l.nota || '')}</textarea></div>`;

  const atualizar = () => {
    salvar(); redesenhar();
    const el = document.getElementById('modal-corpo');
    const y = el.scrollTop;
    el.innerHTML = corpo();
    ligar();
    el.scrollTop = y;
  };

  const ligar = () => {
    const el = document.getElementById('modal-corpo');
    ligarPropriedades(el, regras.propriedades);
    el.querySelectorAll('[data-desgaste]').forEach(b => {
      b.onclick = () => { l.desgaste = Math.max(0, Math.min(10, (l.desgaste || 0) + Number(b.dataset.desgaste))); atualizar(); };
    });
    el.querySelector('#btn-regra-desgaste').onclick = e => {
      e.stopPropagation();
      const p = document.getElementById('regra-desgaste');
      p.hidden = !p.hidden;
    };
    el.querySelectorAll('[data-mel-nivel]').forEach(b => {
      b.onclick = () => {
        const m = (l.melhorias || [])[Number(b.dataset.melNivel)];
        if (!m) return;
        m.nivel += Number(b.dataset.delta);
        if (m.nivel <= 0) l.melhorias = l.melhorias.filter(x => x !== m);
        atualizar();
      };
    });
    el.querySelector('#btn-add-melhoria')?.addEventListener('click', () => {
      l.melhorias = [...(l.melhorias || []), { id: document.getElementById('sel-melhoria').value, nivel: 1 }];
      atualizar();
    });
    el.querySelectorAll('[data-mod-remover]').forEach(b => {
      b.onclick = () => { l.mods = (l.mods || []).filter(id => id !== b.dataset.modRemover); atualizar(); };
    });
    el.querySelector('#btn-add-mod')?.addEventListener('click', () => {
      l.mods = [...(l.mods || []), document.getElementById('sel-mod').value];
      atualizar();
    });
    el.querySelector('#chk-na-bolsa')?.addEventListener('change', e => { l.na_bolsa = e.target.checked; atualizar(); });
    el.querySelector('#det-carga')?.addEventListener('change', e => { l.carga = Number(e.target.value) || 0; atualizar(); });
    el.querySelector('#det-nota').addEventListener('change', e => { l.nota = e.target.value; salvar(); });
  };

  abrirModal(l.nome, corpo(), '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
  ligar();
}

/** Catálogo de itens com busca e filtro por categoria; permite comprar. */
function abrirCatalogo(ctx) {
  const { regras } = ctx;
  const categorias = [...new Set(regras.itens.map(i => i.subcategoria || i.categoria))];
  abrirModal('Catálogo de itens', `
    <div class="filtros">
      <input class="form-input" id="cat-busca" placeholder="Buscar item...">
      <select class="form-select" id="cat-categoria"><option value="">Todas as categorias</option>
        ${categorias.map(c => `<option>${escHtml(c)}</option>`).join('')}</select>
    </div>
    <div id="cat-lista" class="cat-lista"></div>`, '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>');
  const desenhar = () => {
    const q = semAcento(document.getElementById('cat-busca').value);
    const cat = document.getElementById('cat-categoria').value;
    const lista = regras.itens.filter(i => (!cat || (i.subcategoria || i.categoria) === cat) && (!q || semAcento(i.nome).includes(q))).slice(0, 120);
    const el = document.getElementById('cat-lista');
    el.innerHTML = lista.length ? lista.map(i => {
      const custo = custoDoItem(i);
      return `<button type="button" class="cat-item" data-cat-item="${escHtml(i.id)}">
        <span>${escHtml(i.nome)}</span><small>${escHtml(i.subcategoria || i.categoria)}${custo != null ? ` · ${custo} tp` : ''}</small></button>`;
    }).join('') : '<p class="texto-suave">Nada encontrado.</p>';
    el.querySelectorAll('[data-cat-item]').forEach(b => { b.onclick = () => abrirItemCatalogo(regras.catalogo[b.dataset.catItem], ctx); });
  };
  document.getElementById('cat-busca').oninput = desenhar;
  document.getElementById('cat-categoria').onchange = desenhar;
  desenhar();
}

/** Popup de um item do catálogo, com quantidade e opção de pagar. */
function abrirItemCatalogo(item, { char, regras, salvar, redesenhar }) {
  const custo = custoDoItem(item);
  abrirModal(item.nome, `${camposHtml(item, regras.propriedades)}
    <div class="form-group"><label class="form-label" for="cat-qtd">Quantidade</label><input type="number" class="form-input" id="cat-qtd" value="1" min="1"></div>
    ${custo != null ? `<label class="form-check"><input type="checkbox" id="cat-pagar"> Pagar com tampinhas (${custo} tp cada; você tem ${char.tampinhas || 0})</label>` : ''}`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-ok-cat">Adicionar</button>');
  ligarPropriedades(document.getElementById('modal-corpo'), regras.propriedades);
  document.getElementById('btn-ok-cat').onclick = () => {
    const qtd = Math.max(1, Number(document.getElementById('cat-qtd').value) || 1);
    if (document.getElementById('cat-pagar')?.checked) {
      const total = custo * qtd;
      if (total > (char.tampinhas || 0)) { toast('Tampinhas insuficientes.', 'erro'); return; }
      char.tampinhas -= total;
    }
    const existente = char.inventario.find(l => l.ref === item.id && !l.desgaste && !l.equipado && !R.tipoEquipavel(item));
    if (existente) existente.qtd = (existente.qtd || 1) + qtd;
    else char.inventario.push({ id: gerarId(), ref: item.id, nome: item.nome, qtd, equipado: false, desgaste: 0 });
    fecharModal(); fecharModal();
    salvar(); redesenhar();
    toast(`${item.nome} adicionado.`, 'sucesso');
  };
}
