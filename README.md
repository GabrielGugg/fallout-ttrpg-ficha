# Ficha de Personagem — Fallout TTRPG 2.1

Aplicativo web gratuito, em português, para criar e usar fichas do
**Fallout TTRPG 2.1** da Arcane Arcade. Roda no navegador do celular e do
computador, funciona offline (PWA) e guarda os personagens no próprio aparelho.

> Projeto de fã, sem vínculo com a Bethesda ou a Arcane Arcade. Adaptado do
> [criador de fichas D&D 5.5 de ZaitBr-bit](https://github.com/ZaitBr-bit/D-D_2024)
> (licença MIT).

## O que dá para fazer

- **Criar o personagem** em 8 passos: raça (com variantes e os três tipos de
  robô e suas ferramentas acopladas), S.P.E.C.I.A.L., antecedente, perícias,
  talento, traços (com Ermo Selvagem), equipamento inicial e detalhes.
- **Usar a ficha na mesa**: PV, PE e PA, dano aplicado na Ordem do Dano
  (estamina, resistência, TD, vida), cura, descanso, Suspiros Finais, Tampas de
  Karma, Defesa e TD da armadura vestida, Fator de Cura, Sentidos Passivos,
  Limiar de Radiação, carga, perícias com a origem de cada bônus, ataques
  calculados das armas equipadas, Fome, Desidratação, Exaustão, Radiação e
  condições.
- **Inventário** com o catálogo do livro (armas, armaduras, munição, comida,
  químicos), compra com tampinhas, itens livres e Níveis de Desgaste.
- **Subir de nível** pelo assistente: Ponto de Talento (talento ou +1 atributo),
  PV/PE nos níveis ímpares e Pontos de Perícia a partir do nível 5.
- Exportar e importar personagens em JSON.
- **Configurações** com três temas: Pip-Boy, Vault-Tec Escuro e Vault-Tec Claro.

As mudanças de cada versão estão no [CHANGELOG.md](CHANGELOG.md). Ao lançar uma
versão nova, atualize `site/js/versao.js` e acrescente a entrada no topo do
changelog.

## Para desenvolvedores

SPA em JavaScript puro (ES modules), sem build. Para rodar localmente, sirva a
raiz do repositório e abra `/site/`:

```bash
python3 -m http.server 8000   # http://localhost:8000/site/
```

| Pasta / arquivo | Conteúdo |
|---|---|
| `site/js/regras-fallout.js` | Todas as regras puras (sem DOM): SPECIAL, perícias, PV/PE, derivados, ataques, requisitos, dano, descanso |
| `site/js/creator/wizard.js` | Assistente de criação |
| `site/js/sheet/` | Ficha (`ficha.js`), inventário e subida de nível |
| `site/js/ui.js` | Cards, popups e seletor de talentos |
| `dados/fallout/*.json` | Raças, antecedentes, traços, talentos, itens e condições |
| `scripts/fallout/extrair_regras.py` | Gera os JSON a partir das notas .md traduzidas |
| `testes/fallout/` | Testes das regras (`npm test`) |

### Atualizar os dados a partir da tradução

Os JSON de `dados/fallout/` são gerados das notas do Obsidian com a tradução do
livro. Depois de mudar as notas, rode:

```bash
python3 scripts/fallout/extrair_regras.py "caminho/da/pasta/Regras"
```

### Publicação

O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push
na `main` (ative em *Settings → Pages → Source: GitHub Actions*).
