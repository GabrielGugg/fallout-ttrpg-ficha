// ============================================================
// Inventário: itens, tampinhas, equipar, desgaste e compra do catálogo
// ============================================================
import { escHtml, abrirModal, fecharModal, toast, gerarId, semAcento } from '../utils.js';
import * as R from '../regras-fallout.js';
import { realcarPropriedades, ligarPropriedades } from '../ui.js';

/** Itens que podem ser equipados (armas e armaduras). */
function equipavel(item) {
  return !!item && (R.periciaDaArma(item) || (item.categoria === 'Armaduras' && !item.subcategoria));
}

/** Custo em tampinhas de um item do catálogo (null se não tiver). */
export function custoDoItem(item) {
  const campo = item?.campos?.['Custo Base'] ?? item?.campos?.Custo;
  const m = String(campo || '').replace(/\./g, '').match(/(\d+)\s*tp/);
  return m ? Number(m[1]) : null;
}

/** HTML da seção de inventário. */
export function secaoInventario({ char, regras }) {
  const linhas = char.inventario || [];
  return `
    <div class="tampinhas-linha">
      <span>Tampinhas: <strong>${char.tampinhas || 0}</strong></span>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-tampinhas">Ajustar</button>
    </div>
    <div class="inv-lista">${linhas.length ? linhas.map(l => {
      const item = regras.catalogo[l.ref];
      const carga = l.carga != null ? Number(l.carga) : R.cargaDoItem(item);
      return `<div class="inv-item${l.equipado ? ' equipado' : ''}">
        <button type="button" class="inv-nome link" data-inv-ver="${escHtml(l.id)}">${escHtml(l.nome)}</button>
        <span class="inv-meta">${item ? escHtml(item.subcategoria || item.categoria) : 'Item livre'} · carga ${carga}${l.desgaste ? ` · desgaste ${l.desgaste}` : ''}</span>
        <span class="inv-controles">
          ${equipavel(item) ? `<label class="form-check"><input type="checkbox" data-inv-equipar="${escHtml(l.id)}" ${l.equipado ? 'checked' : ''}> ${item.categoria === 'Armaduras' ? 'Vestida' : 'Equipada'}</label>` : ''}
          <span class="stepper"><button type="button" data-inv-qtd="${escHtml(l.id)}" data-delta="-1">−</button><span>${l.qtd || 1}</span>
          <button type="button" data-inv-qtd="${escHtml(l.id)}" data-delta="1">+</button></span>
        </span>
      </div>`;
    }).join('') : '<p class="texto-suave">Inventário vazio.</p>'}</div>
    <div class="botoes-escolha">
      <button type="button" class="btn btn-primary btn-sm" id="btn-add-catalogo">+ Do catálogo</button>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-add-livre">+ Item livre</button>
    </div>`;
}

/** Liga os eventos da seção de inventário. */
export function ligarInventario(raiz, ctx) {
  const { char, regras, salvar, redesenhar } = ctx;
  const achar = id => char.inventario.find(l => l.id === id);

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
      if (cb.checked && item?.categoria === 'Armaduras') {
        char.inventario.forEach(o => {
          const oi = regras.catalogo[o.ref];
          if (o !== l && oi?.categoria === 'Armaduras' && !oi.subcategoria) o.equipado = false;
        });
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

/** Tabela com os campos de um item do catálogo; propriedades ganham dica com a regra. */
function camposHtml(item, propriedades) {
  return `<table class="tabela-campos">${Object.entries(item.campos).filter(([k, v]) => v && v !== item.nome)
    .map(([k, v]) => `<tr><th>${escHtml(k.replace(/ \d+$/, ''))}</th><td>${/Propriedades|Efeito|Descrição/.test(k) ? realcarPropriedades(v, propriedades) : escHtml(v)}</td></tr>`).join('')}</table>`;
}

/** Popup de uma linha do inventário: campos, desgaste, notas, carga. */
function abrirDetalheLinha(l, { char, regras, salvar, redesenhar }) {
  const item = regras.catalogo[l.ref];
  abrirModal(l.nome, `
    ${item ? camposHtml(item, regras.propriedades) : '<p class="texto-suave">Item livre, fora do catálogo.</p>'}
    <div class="form-group"><label class="form-label" for="det-desgaste">Níveis de Desgaste</label>
      <input type="number" class="form-input" id="det-desgaste" min="0" value="${l.desgaste || 0}"></div>
    ${!item ? `<div class="form-group"><label class="form-label" for="det-carga">Carga (cada)</label>
      <input type="number" class="form-input" id="det-carga" min="0" step="0.5" value="${l.carga || 0}"></div>` : ''}
    <div class="form-group"><label class="form-label" for="det-nota">Notas (melhorias, modificações)</label>
      <textarea class="form-textarea" id="det-nota" rows="2">${escHtml(l.nota || '')}</textarea></div>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button><button class="btn btn-primary" id="btn-ok-linha">Salvar</button>');
  ligarPropriedades(document.getElementById('modal-corpo'), regras.propriedades);
  document.getElementById('btn-ok-linha').onclick = () => {
    l.desgaste = Math.max(0, Number(document.getElementById('det-desgaste').value) || 0);
    l.nota = document.getElementById('det-nota').value;
    const carga = document.getElementById('det-carga');
    if (carga) l.carga = Number(carga.value) || 0;
    fecharModal(); salvar(); redesenhar();
  };
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
    const existente = char.inventario.find(l => l.ref === item.id && !l.desgaste && !l.equipado && !equipavel(item));
    if (existente) existente.qtd = (existente.qtd || 1) + qtd;
    else char.inventario.push({ id: gerarId(), ref: item.id, nome: item.nome, qtd, equipado: false, desgaste: 0 });
    fecharModal(); fecharModal();
    salvar(); redesenhar();
    toast(`${item.nome} adicionado.`, 'sucesso');
  };
}
