// ============================================================
// Carregamento dos dados de jogo (dados/fallout/*.json), com cache
// ============================================================
const BASE_PATH = '../dados/fallout';
const cache = new Map();

/** Busca um JSON de dados uma única vez por sessão. */
async function fetchJSON(nome) {
  if (!cache.has(nome)) {
    cache.set(nome, fetch(`${BASE_PATH}/${nome}`).then(r => {
      if (!r.ok) throw new Error(`Falha ao carregar ${nome}`);
      return r.json();
    }));
  }
  return cache.get(nome);
}

/** Carrega todos os dados de regras de uma vez e monta índices por id. */
export async function carregarRegras() {
  const [racas, antecedentes, tracos, talentos, itens, condicoes, propriedades, pericias] = await Promise.all([
    fetchJSON('racas.json'), fetchJSON('antecedentes.json'), fetchJSON('tracos.json'),
    fetchJSON('talentos.json'), fetchJSON('itens.json'), fetchJSON('condicoes.json'),
    fetchJSON('propriedades.json'), fetchJSON('pericias.json'),
  ]);
  return {
    racas, antecedentes, tracos, talentos, itens, condicoes, propriedades, pericias,
    catalogo: Object.fromEntries(itens.map(i => [i.id, i])),
    talentoPorId: Object.fromEntries(talentos.map(t => [t.id, t])),
  };
}
