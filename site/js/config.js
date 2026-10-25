// ============================================================
// Configurações do app (guardadas neste aparelho): por enquanto, o tema
// ============================================================

const CHAVE = 'fallout_config';

/** Temas disponíveis. `cor` vai para o meta theme-color (barra do navegador no celular). */
export const TEMAS = [
  { id: 'pipboy', nome: 'Pip-Boy', descricao: 'Verde fósforo sobre preto.', cor: '#0b140d', amostra: ['#0b140d', '#101d12', '#3ef07a', '#b8f5c8'] },
  { id: 'vault-escuro', nome: 'Vault-Tec Escuro', descricao: 'Amarelo Vault-Tec sobre azul-marinho.', cor: '#000c16', amostra: ['#001423', '#0066b1', '#fff773', '#ffffff'] },
  { id: 'vault-claro', nome: 'Vault-Tec Claro', descricao: 'Fundo branco com azul e amarelo.', cor: '#0066b1', amostra: ['#ffffff', '#0066b1', '#fff773', '#001423'] },
];

/** Lê as configurações (com padrões; sem armazenamento, só os padrões). */
export function lerConfig() {
  let salvo = {};
  try { salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch { salvo = {}; }
  return { tema: 'pipboy', ...salvo };
}

/** Grava as configurações, mesclando com as atuais. */
export function salvarConfig(mudancas) {
  const nova = { ...lerConfig(), ...mudancas };
  try { localStorage.setItem(CHAVE, JSON.stringify(nova)); } catch { /* sem armazenamento: vale só nesta visita */ }
  return nova;
}

/** Aplica o tema no <html> e na cor da barra do navegador. */
export function aplicarTema(id) {
  const tema = TEMAS.find(t => t.id === id) || TEMAS[0];
  document.documentElement.dataset.tema = tema.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema.cor);
}
