# IANE Design System v3.4 — GELIN

Base visual única do GELIN. Este documento cobre tokens, componentes, temas, acessibilidade
e o processo para manter a consistência. A referência oficial é `IANE Design System v3.4`.

## 1. Estrutura

```
src/design-system/
  tokens/colors.css      # primitivos, semânticos (claro/escuro) e paleta de dados
  tokens/typography.css  # pilha de fontes do sistema
  tokens/spacing.css     # espaço, raios, duração e camadas
  tokens/themes.css      # ponte com o Tailwind v4 + compatibilidade legada
  theme-provider.tsx     # tema claro/escuro persistido em localStorage
  toast-provider.tsx     # notificações globais
src/index.css            # base global, tipografia e classes .ds-*
src/components/          # biblioteca de componentes
```

Regra das três camadas:

1. **Primitivos** — valores crus da marca (`--blue-600`, `--navy-900`, `--sun-400`).
   Uso restrito ao menu, cabeçalhos e destaques.
2. **Semânticos** — o que a tela consome (`--bg`, `--surface`, `--text`, `--accent`).
   É a única camada usada em páginas e componentes.
3. **Componentes** — decisões locais (`--chart-*`). Só entram aqui quando um componente
   precisa de uma cor que não existe na camada semântica.

## 2. Tokens

### Cor (semânticos)

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#F6F8FF` | `#0A0B26` | fundo da página |
| `--surface` | `#FFFFFF` | `#12143A` | cartões, campos, modais |
| `--subtle` | `#EDF1FC` | `#1A1D46` | hover, cabeçalho de tabela |
| `--line` | `#DCE2F5` | `#262A55` | divisores |
| `--line-strong` | `#7C84AA` | `#6E75A8` | borda de controle |
| `--text` | `#0F1238` | `#EEF0FF` | texto principal |
| `--muted` | `#4B5378` | `#A8AED6` | apoio e legendas |
| `--accent` | `#0A6EF0` | `#4DB5FF` | ação principal |
| `--on-accent` | `#FFFFFF` | `#08102A` | texto sobre acento |
| `--focus` | `#3A32A0` | `#FFD91A` | anel de foco |

Status (sempre com ícone e texto, nunca só cor):

| Família | Tokens |
| --- | --- |
| Sucesso | `--ok-bg`, `--ok-fg`, `--ok-bd` |
| Aviso | `--warn-bg`, `--warn-fg`, `--warn-bd` |
| Erro | `--danger-bg`, `--danger-fg`, `--danger-bd` |
| Informação | `--info-bg`, `--info-fg`, `--info-bd` |

Paleta de dados dos gráficos: `--chart-1` a `--chart-8` e `--chart-track`, com valores
distintos por tema. Componentes nunca declaram hex; usam a variável.

### Tipografia

Fonte do sistema (`ui-sans-serif` e derivados), sem download externo. Mono para IMEI,
matrícula, protocolo e códigos.

| Papel | Classe | Tamanho / peso |
| --- | --- | --- |
| Título de página | `ds-page-title` / `text-page` | 28px / 650 |
| Título de seção | `text-section` | 20px / 650 |
| Subtítulo | `text-subtitle` | 15px / 650 |
| Corpo | `text-body` | 14px / 400 |
| Apoio | `text-caption` | 12px / 400 |
| Ênfase | `font-strong` | 650 |

### Espaço, forma e movimento

- Espaçamento em múltiplos de 4px (`--s1`…`--s7`).
- Raios: 6px para controles (`--r`), 10px para superfícies (`--r2`).
- Durações: 120ms (`--dur-fast`) e 200ms (`--dur`).
- Breakpoints: `sm` 700px e `lg` 1024px.

## 3. Uso com Tailwind

Prefira os utilitários semânticos:

```tsx
<div className="bg-surface border border-line text-text rounded-lg">
  <p className="text-muted text-caption">Apoio</p>
  <button className="bg-accent text-on-accent hover:bg-accent/90">Salvar</button>
</div>
```

- `bg-bg`, `bg-surface`, `bg-subtle`
- `border-line`, `border-line-strong`
- `text-text`, `text-muted`
- `bg-accent`, `text-on-accent`, `ring-focus`
- `text-ok-fg`, `bg-ok-bg`, `border-ok-bd` (idem warn/danger/info)

Nunca use cor literal (`#…`), `text-white`/`bg-white` ou `gray-*` em código novo.
A paleta antiga `ink-*` continua mapeada para os semânticos apenas por compatibilidade
das telas legadas; não a use como referência.

## 4. Temas

O tema é aplicado em `<html data-theme="light|dark">`.

- `ThemeProvider` lê a preferência salva em `localStorage` (`iane_theme`).
- Um script em `index.html` aplica o tema antes da pintura, evitando flash.
- O botão de alternância fica no rodapé do menu lateral (`Sidebar`).
- Por usar variáveis CSS, TODO componente já responde ao tema sem código extra.

## 5. Componentes

Todos ficam em `src/components/` (arquivos em minúsculas, exportações em PascalCase).

| Componente | Principais props | Observações |
| --- | --- | --- |
| `Button` | `variant`: primary, secondary, outline, ghost, destructive, brand; `size`: sm, md, lg, icon; `loading` | Um primário por tela. `brand` (amarelo) só para chamadas pontuais. |
| `Badge` | `variant`: default, secondary, outline, success, warning, info, danger; `size` | Selo apenas para o que exige atenção ou mudou. |
| `StatusBadge` | `status`, `size` | Sempre ícone + texto; o significado não depende da cor. |
| `Field` | `id`, `label`, `hint`, `error`, `required` | Use `fieldDescribedBy(id, error, hint)` no `aria-describedby`. |
| `Input`, `Select`, `Textarea`, `Checkbox`, `Switch` | props nativas | Já trazem borda, foco e estados de erro. |
| `Card` + `CardHeader/Title/Description/Content/Footer` | `variant`, `padding` | Superfície padrão de conteúdo. |
| `Alert` | `tone`, `title`, `icon` | `role` automático (`status` ou `alert`). |
| `Table` + `TableHead/Body/Row/HeaderCell/Cell` | `TableCell label` | `label` alimenta o cartão em telas estreitas. |
| `EmptyState` | `title`, `description`, `icon`, `tone`, `action` | Estados vazios e de erro. |
| `Modal` | `isOpen`, `onClose`, `title`, `subtitle`, `footer`, `maxWidth` | `<dialog>` nativo: foco preso, Esc fecha, foco volta à origem. |
| `ToastProvider` / `useToast` | `toast({ title, description, tone, duration, action })` | Máximo de 3, dispensável, pausa no hover/foco; erro é persistente por padrão. |
| `DeviceDetail` | dados do aparelho + abas | Modal de detalhe com histórico, termos e QR code. |

### Tabela responsiva

Toda tabela do sistema usa `.ds-table` e cada `<td>` recebe `data-label`:

```tsx
<table className="ds-table">
  <thead>…</thead>
  <tbody>
    <tr>
      <td data-label="Código">REG-0482</td>
      <td data-label="Status"><StatusBadge status="Concluído" /></td>
    </tr>
  </tbody>
</table>
```

Abaixo de 700px cada linha vira um cartão com rótulo e valor, sem rolagem lateral.
Relatórios largos, que dependem de comparação entre colunas, mantêm rolagem horizontal.

## 6. Acessibilidade (WCAG 2.2 AA)

- Contraste de texto ≥ 4,5:1; componentes e ícones ≥ 3:1.
- Foco sempre visível (`ring-focus`) e na ordem do DOM.
- Todo status tem ícone e texto; cor nunca é o único indicador.
- `Modal` usa `<dialog>`: foco preso, `aria-labelledby`/`aria-describedby` e Esc.
- Toasts usam `aria-live="polite"`; erros e avisos usam `role="alert"`.
- `prefers-reduced-motion` desliga animações e transições.
- Botões de ícone sempre com `aria-label`.

## 7. Governança

1. **Antes de criar**, verifique se o componente já existe. Um componente novo só entra
   na biblioteca com pelo menos dois usos reais.
2. **Sem valores novos**: se falta uma cor, primeiro tente um token semântico existente.
   Se realmente não houver, crie um token de componente (como `--chart-*`) nos dois temas.
3. **Sem dependências novas** para resolver estilo. A base é Tailwind v4 + `tailwind-variants`
   + `tailwind-merge`.
4. **Sem `React.FC` e sem `any`** em código novo.
5. **Não altere regra de negócio** ao migrar uma tela: só marcação, estilo e componentes.
6. **Permissões e filtros** continuam validados no backend, não apenas na interface.
7. Toda mudança de token precisa ser verificada nos dois temas e nos dois breakpoints.
8. Alterações de componente exigem `npm.cmd run lint`, `npm.cmd run build` e `npm.cmd test`.

## 8. Migração de uma tela

1. Troque cores literais e `gray-*`/`ink-*` pelos utilitários semânticos.
2. Troque `<button>` estilizado por `Button` quando o visual for de ação do sistema.
3. Troque campos por `Field` + `Input`/`Select`/`Textarea`, ligando `aria-describedby`.
4. Troque status coloridos por `StatusBadge`.
5. Troque modais caseiros por `Modal`.
6. Adicione `.ds-table` e `data-label` nas tabelas.
7. Troque alertas flutuantes por `useToast`.
8. Valide teclado, tema escuro, 700px e 1024px.

## 9. Comandos

```bash
npm.cmd run lint     # tsc --noEmit
npm.cmd run build    # build de produção
npm.cmd test         # suíte de testes
```

Os testes de banco exigem PostgreSQL/Docker; sem eles, são pulados e o restante roda normalmente.
