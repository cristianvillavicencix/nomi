# Button system

Single source of truth for CRM actions. Prefer these components over hand-rolled `<button>` for CTAs, toolbar icons, and form actions.

## Components

| Component | Path | Use for |
| --- | --- | --- |
| `Button` | `src/components/ui/button.tsx` | Labeled actions |
| `IconButton` | `src/components/ui/icon-button.tsx` | Icon-only controls (requires `aria-label`) |
| `buttonVariants` | `src/components/ui/button.variants.ts` | Links / triggers that need the same look without `<button>` |
| `IconButtonWithTooltip` | `src/components/admin/icon-button-with-tooltip.tsx` | Admin icon actions with i18n tooltip |

## Variants

| Variant | When |
| --- | --- |
| `primary` | One main CTA per view (save, send, pay, create) |
| `secondary` | Bordered alternative (cancel alongside primary, export, filters) |
| `ghost` | Tertiary / chrome (toolbar, dismiss, overflow) |
| `destructive` | Irreversible or dangerous confirms |
| `link` | Inline text actions (deprecated alias; prefer `ghost` or real links) |

Legacy aliases still resolve: `default` → `primary`, `outline` → `secondary`. Prefer the new names on new code.

## Sizes

| Size | Height | Notes |
| --- | --- | --- |
| `sm` | 32px | Dense toolbars, table rows |
| `md` | 36px | Default |
| `lg` | 44px | Public / marketing CTAs (e.g. pay invoice) |
| `icon` | 32×32 | Icon-only; use `IconButton` |

## Create actions

List / toolbar **New …** / **Create …** buttons use the **Plus** icon, not domain icons (`Building2`, `UserPlus`, etc.). Domain icons stay for empty states, pickers, and decorative headers.

```tsx
<Button variant="secondary" size="sm">
  <Plus className="size-4" />
  New contact
</Button>
```

## Icon-only

```tsx
<IconButton aria-label="Previous month" onClick={…}>
  <ChevronLeft className="size-4" />
</IconButton>
```

- Always set `aria-label` (or `title` / `aria-labelledby`).
- Default variant is `ghost`. Use `secondary` for bordered chrome, `primary` for floating primary FABs.
- Do not override with `className="size-8"` — `icon` is already 32×32. Override only for denser (`size-6` / `size-7`) or larger FABs (`size-12`).

## When **not** to use `Button` / `IconButton`

Keep a native `<button>` (or other primitive) when the control is **not** a system CTA:

- Settings / ticket nav tabs and sidebar items
- Filter chips with custom colors (`WorkCategoryChips`, status breadcrumbs)
- Kanban card drag handles
- Full-width list / menu rows inside popovers
- Complex disclosure headers with multi-line layout
- Summary metric cards that act as filters

Those need custom layout or pressed styles that fight `Button`’s label wrapper and `active:scale`.

## Loading

Use `isLoading` on `Button` instead of swapping icons manually. The control stays the same width and shows a spinner.

## Responsive toolbars

Header actions live in `PageActions` (portaled into the top bar). Keep one horizontal row — the slot scrolls; do not invent overflow `⋯` menus.

| Piece | Rule |
| --- | --- |
| `ToolbarLabel` | Collapse text on narrow viewports; keep icon + `aria-label`. `primary` (create CTAs) from `sm`; `secondary` (filters / view toggles) from `md`. |
| `PAGE_ACTIONS_CLUSTER` | Right-side cluster: `ml-auto` + `flex-nowrap` — never wrap. |
| View toggles (List / Board) | Prefer icon + label like Accounts (`List` + `KanbanSquare`). Keep internal preference values stable if renaming labels. |
| Long chrome (emails) | Hide below `lg` when optional (`hidden lg:inline-flex`). |

In-page action rows (banners, create footers): stack on mobile with `flex-col gap-2 sm:flex-row` instead of wrap-only.

```tsx
<PageActions>
  <ToggleGroupItem value="table" aria-label="Table view">
    <ListIcon className="size-4" />
    <ToolbarLabel>Table</ToolbarLabel>
  </ToggleGroupItem>
  <div className={PAGE_ACTIONS_CLUSTER}>
    <Button variant="secondary" size="sm" aria-label="New lead">
      <Plus className="size-4" />
      <ToolbarLabel priority="primary">New lead</ToolbarLabel>
    </Button>
  </div>
</PageActions>
```

## Checklist for new UI

1. One `primary` per view (or dialog footer).
2. Cancel / secondary actions → `secondary` or `ghost`.
3. Icon-only → `IconButton` + `aria-label`.
4. Create / New → `Plus` + `secondary` or `primary` as appropriate.
5. No hardcoded `bg-black` / `bg-blue-600` on CTAs — use brand variants.
6. Header denseness → `ToolbarLabel` + `PAGE_ACTIONS_CLUSTER`; in-page → `flex-col sm:flex-row`.
