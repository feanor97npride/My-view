# My View — Design System

Guia oficial de tokens, componentes e movimento do **My View**. Todas as novas telas e features devem usar estas primitivas e nunca introduzir cores fixas (`hex`/`rgb`) fora de [`src/app/globals.css`](src/app/globals.css).

---

## 1. Princípios
1. **Cockpit Bento:** blocos principais em cards arredondados (`26px` via `.card.bento-card`), itens internos em `16px` (`rounded-2xl`) com fundo `--bg` ou `--surface-3`.
2. **Ação com segurança:** ações mutáveis usam atualização otimista + `ActionToast` com **Desfazer (6 s)**.
3. **Claro e Escuro nativos:** todo componente usa variáveis CSS semânticas para alternar temas sem ajustes manuais.
4. **Movimento com propósito:** curvas *spring* suaves e suporte obrigatório a `prefers-reduced-motion`.

---

## 2. Tokens Semânticos (`src/app/globals.css`)

| Categoria | Tokens | Uso |
|---|---|---|
| Superfícies | `--bg`, `--card`, `--surface-3` | Fundo da página, card principal, sub-blocos/destaques |
| Bordas | `--line`, `--line-strong` | Divisores, contornos de cards e inputs |
| Texto | `--ink`, `--mute`, `--link` | Texto principal, secundário, links |
| Marca | `--primary`, `--primary-soft`, `--primary-ink`, `--on-primary` | Ação primária, seleção ativa |
| Status / Chips | `--red-*`, `--amber-*`, `--green-*`, `--violet-*`, `--blue-*`, `--slate-*`, `--pink-*`, `--teal-*` | Use `.chip` + `.chip-{tom}` |
| Tendência | `--trend` | Indicadores positivos e picos |
| Categorias (E-mail) | `--cat-{nome}`, `--k-{fila}` / `--kt-{fila}` | Gráficos de barras e filas da mesa de triagem |

### Tipografia
- **Display / Títulos / Números:** `font-display` (`Space Grotesk`) + `tabular-nums` para métricas e horários.
- **Corpo:** `font-sans` (`Inter`), tamanho mínimo recomendado `12px` (`text-xs`).

---

## 3. Componentes Base (`@/components/ui`)

Importe sempre de `@/components/ui`:

- **`BentoCard`**: wrapper padrão de seção (`card bento-card`), com props `as` (`"section" | "div"`), `className` e atributos HTML.
- **`SectionHeader`**: cabeçalho padronizado de bloco (`title`, `subtitle`, `action` à direita).
- **`ActionToast`**: toast flutuante acessível (`role="status"`, `aria-live="polite"`) com barra regressiva de 6s, botão *Desfazer* e botão extra opcional.

### Classes utilitárias (`globals.css`)
- **Cards:** `.card.bento-card`
- **Chips:** `.chip`, `.chip-red`, `.chip-amber`, `.chip-green`, `.chip-violet`, `.chip-blue`, `.chip-slate`, `.chip-pink`, `.chip-teal`, `.chip-primary`
- **Botões:** `.btn`, `.btn-primary`, `.spring-btn` (efeito tátil ao clicar)
- **Animações de entrada:** `.spring-card` + `.spring-d1` / `.spring-d2` / `.spring-d3`

---

## 4. Checklist para Novas Implementações
- [ ] Usar `BentoCard` e `SectionHeader` para novos blocos.
- [ ] Usar `ActionToast` para qualquer ação que altere dados no Google, ClickUp ou Neon.
- [ ] Adicionar `.spring-btn` em botões de ação e `.spring-card` na entrada das seções principais.
- [ ] Usar apenas tokens CSS semânticos (testar visualmente nos temas claro e escuro).
- [ ] Garantir `tabular-nums` em contadores, datas, horários e percentuais.
