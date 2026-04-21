# Feedback for the dlite design system

Compiled while building `listings-tracker`. Every item below is backed by a real spot in this codebase where the absence of the utility or component forced us into inline styles, a custom `<style>` block, a bespoke React component, or a hand-rolled CSS hack. Paths are relative to the repo root.

Two audiences:
1. **`style-dictionary-dlite-tokens`** maintainers — utility class gaps.
2. **`web-components-dlite`** maintainers — component gaps.

Severity is pragmatic:
- **P0** = we reinvented a whole thing or hard-coded design values that should live in tokens.
- **P1** = mildly annoying — worked around with a one-off style, but consumers will keep hitting it.
- **P2** = nice-to-have for polish.

---

## 1. `style-dictionary-dlite-tokens` — missing utility classes

### 1.1 Pseudo-class states (`:hover`, `:focus-visible`, `:disabled`, `:active`)  — **P0**

**Where we hit it:** [src/app/properties/page.tsx](src/app/properties/page.tsx) — the filter chips on the buyer dashboard needed `:hover` and `:focus-visible` styles. Inline styles can't set pseudo-classes, so we had to embed a `<style>` block *inside a React component*:

```tsx
<style>{`
  .lt-chip:hover { border-color: #cbd5e1; }
  .lt-chip:focus-visible { box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.2); }
`}</style>
```

**What we'd like:** variant-prefixed utility classes, Tailwind-style:
- `.cl-dlite-hover-sem-bg-sunken`
- `.cl-dlite-focus-visible-sem-shadow-sm`
- `.cl-dlite-disabled-sem-text-muted`

The utilities file already has `.cl-dlite-disabled-opacity-50:disabled` (great pattern). Extend that pattern to hover/focus-visible/active for the common properties (bg, text, border, shadow, transform).

### 1.2 Grid-template-columns utilities  — **P0**

**Where we hit it:** [src/app/admin/dashboard/page.tsx](src/app/admin/dashboard/page.tsx) line 92, [src/components/buyer/MarketSummary.tsx](src/components/buyer/MarketSummary.tsx), [src/components/Skeleton.tsx](src/components/Skeleton.tsx), and [src/dlite-design-system/styles.css](src/dlite-design-system/styles.css) custom `.grid-responsive` rule. Every time we want `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))` we have to drop to inline style.

**What we'd like:** utilities for the most common responsive grid patterns:
- `.cl-dlite-grid-auto-fit-xs / sm / md / lg` — maps to `repeat(auto-fit, minmax(120px/160px/220px/280px, 1fr))`
- `.cl-dlite-grid-cols-2 / 3 / 4` — fixed column counts
- `.cl-dlite-grid-cols-1 .cl-dlite-md:grid-cols-2` — responsive variants

### 1.3 Responsive breakpoint prefixes  — **P0**

**Where we hit it:** everywhere we wanted "2-up on desktop, stack on mobile" we had to write media queries in [src/dlite-design-system/styles.css](src/dlite-design-system/styles.css) (`.form-row`, `.form-grid`, `.header-row`) rather than use utilities.

**What we'd like:** responsive variants on the core utilities — `sm:`, `md:`, `lg:` prefixes matching dlite's 640 / 768 / 1024 breakpoints, e.g.:
- `.cl-dlite-flex-col .cl-dlite-md:flex-row`
- `.cl-dlite-sem-gap-200 .cl-dlite-md:sem-gap-400`
- `.cl-dlite-hidden .cl-dlite-md:block`

### 1.4 Specific z-index scale beyond `z-10`  — **P1**

**Where we hit it:**
- [src/components/Toast.tsx](src/components/Toast.tsx) needs `zIndex: 1100` (above dialogs).
- [src/app/property/[id]/page.tsx](src/app/property/[id]/page.tsx) gallery modal: `zIndex: 1000`.
- [src/app/properties/page.tsx](src/app/properties/page.tsx) floating compare bar: `zIndex: 50`.
- sticky filter bar: `zIndex: 10`.

**What we'd like:** a documented z-index scale with named levels and a utility per level:
- `.cl-dlite-z-dropdown` (10), `.cl-dlite-z-sticky` (20), `.cl-dlite-z-fixed` (30), `.cl-dlite-z-overlay` (40), `.cl-dlite-z-modal` (50), `.cl-dlite-z-toast` (60).

Saves every consumer from picking arbitrary numbers.

### 1.5 `backdrop-filter` utility  — **P1**

**Where we hit it:** [src/app/properties/page.tsx](src/app/properties/page.tsx) sticky filter bar: `backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px)` — Safari prefix required.

**What we'd like:** `.cl-dlite-backdrop-blur-sm/md/lg` with the `-webkit-` prefix baked in.

### 1.6 `opacity` utilities and `cursor-grab`  — **P2**

**Where we hit it:** [src/app/property/[id]/page.tsx](src/app/property/[id]/page.tsx) drag-to-reorder photos uses `opacity: 0.5` on the dragging card and `cursor: grab` on the draggable. Had to inline.

**What we'd like:** `.cl-dlite-opacity-0/25/50/75/100` and `.cl-dlite-cursor-grab` to match the existing `cursor-pointer` / `cursor-not-allowed`.

### 1.7 Status / semantic color pills  — **P0 for tokens, P2 for utilities**

**Where we hit it:** Every project with "status" pills reinvents the palette. We have four listing statuses — `active`, `pending`, `sold`, `withdrawn` — each needs a `bg`, `border`, `color`, `label`. We hard-coded these four times: [src/app/properties/page.tsx](src/app/properties/page.tsx) (old version before refactor), [src/components/buyer/ListingCard.tsx](src/components/buyer/ListingCard.tsx), [src/app/admin/properties/page.tsx](src/app/admin/properties/page.tsx), [src/app/property/[id]/page.tsx](src/app/property/[id]/page.tsx), [src/app/admin/codes/page.tsx](src/app/admin/codes/page.tsx).

**What we'd like:**
1. A **color scale** in tokens (50/100/200/…/900) for blue, green, orange, red, purple, amber — so consumers can stop hand-mixing `#dbeafe`, `#f59e0b`, `#166534`, etc. Currently `semantics.css` only exposes `primary/secondary/tertiary/danger/success/warning/info` at a single intensity each — you can't express the "soft filled badge" pattern (light bg + dark text + medium border) without hex codes.
2. Utility classes like `.cl-dlite-sem-bg-success-soft` + `.cl-dlite-sem-border-success-soft` + `.cl-dlite-sem-text-success-strong` to compose the pill style declaratively.

### 1.8 Shorthand margin utilities (`my-*`, `mx-*`)  — **P2**

[semantics.css](node_modules/style-dictionary-dlite-tokens/dist/web/puente/default/semantics.css) has `py-*`, `px-*` but no `my-*` / `mx-*`. Had to write `mt-400 mb-400` in multiple places.

### 1.9 Typography weight + line-clamp  — **P2**

Missing: `.cl-dlite-font-normal/500/600/700/800`. We inline `fontWeight: 600/700` often.
Missing: `.cl-dlite-line-clamp-1/2/3` (utility exists for single-line `truncate`, not multi-line). We want it for card notes.

### 1.10 Gap-between-group (`:not(:last-child)` patterns)  — **P2**

When dlite components stack in a vertical flex with gap, that's fine. But for complex layouts with dividers between items, a `divide-y` utility (like Tailwind's `divide-y-sm`) using `border-bottom` on children would be cleaner.

### 1.11 Animation / transition duration utilities beyond `transition-colors`  — **P2**

Only `.cl-dlite-sem-transition-colors` exists. Missing: `.cl-dlite-sem-transition-all`, `.cl-dlite-sem-transition-transform`, `.cl-dlite-sem-duration-fast/medium/slow`.

### 1.12 Aspect ratio  — **P2**

Hero images on listing cards fix `height: 220px`. With `.cl-dlite-aspect-16-9` / `-4-3` / `-1-1` we could avoid the magic number.

---

## 2. `web-components-dlite` — missing / improvable components

Quick note: we're using `dl-button`, `dl-card`, `dl-heading`, `dl-input`, `dl-spinner`, `dl-stack`, `dl-text`, `dl-textarea`, `dl-divider` extensively, and they're great. Below is what we had to build ourselves or cope around.

### 2.1 `dl-toast` — **P0**

**What we built:** [src/components/Toast.tsx](src/components/Toast.tsx) — a 90-line component with a module-level listener registry, container portal, success/error/info variants, auto-dismiss, shimmer-in animation, `aria-live`. Every app that mutates data needs this.

**Suggested API:**
```html
<dl-toast variant="success" duration="3500">Saved.</dl-toast>
```
Plus a JS helper: `dlToast.success("Saved.")` that imperatively adds to a managed container. Would also want positioning variants (top-right, bottom-center, etc.).

### 2.2 `dl-empty-state` — **P1**

**What we built:** [src/components/EmptyState.tsx](src/components/EmptyState.tsx) — icon + title + description + action slot.

**Suggested API:**
```html
<dl-empty-state icon="🏠" heading="No listings yet" description="...">
  <dl-button slot="action" variant="primary">Add one</dl-button>
</dl-empty-state>
```

### 2.3 `dl-skeleton` — **P1**

**What we built:** [src/components/Skeleton.tsx](src/components/Skeleton.tsx) — shimmer placeholder with preset shapes (`ListingCardSkeleton`, `SummarySkeleton`). Every app with async data needs skeleton loaders.

**Suggested API:**
```html
<dl-skeleton width="100%" height="1rem" />
<dl-skeleton-card /> <!-- preset: image-ish top + title + two lines -->
```

### 2.4 `dl-chip` / tag-with-icon  — **P1**

**What we built:** a local `Chips` group in [src/app/properties/page.tsx](src/app/properties/page.tsx) and a local `Chip` component in [src/components/buyer/ListingCard.tsx](src/components/buyer/ListingCard.tsx). `dl-badge` exists but only with 5 fixed `variant` values and no way to:
- Add an icon.
- Show a selected/pressed/toggled state.
- Group them with `role="group"` for radio-like filter rows.

**Suggested API:**
```html
<dl-chip-group value="active" aria-label="Filter by status">
  <dl-chip value="all">All</dl-chip>
  <dl-chip value="active">Active</dl-chip>
  <dl-chip value="sold">Sold</dl-chip>
</dl-chip-group>
```

### 2.5 `dl-select` styling mismatch — **P0 for styling parity**

`dl-select` already exists (good!), but its native chrome doesn't visually match `dl-input` — different heights, different rendering of the chevron across OSes. We ended up using raw `<select>` with `appearance: none` + an inline SVG chevron in [src/components/formControlStyles.ts](src/components/formControlStyles.ts) because that was the only way to guarantee it lined up with `dl-input`.

**Suggested:** either (a) make `dl-select` use the same rendering as `dl-input` (custom listbox popup), or (b) document how to make `<select>` match `dl-input` via a CSS variable for height.

### 2.6 `dl-date-picker` — **P1**

Native `<input type="date">` renders wildly differently across Chrome/Safari/Firefox/iOS and ignores `appearance: none`. On [src/app/admin/properties/page.tsx](src/app/admin/properties/page.tsx) mark-sold dialog and [src/app/property/[id]/page.tsx](src/app/property/[id]/page.tsx) price history, the date picker looks out of place next to styled dlite inputs.

**Suggested:** `dl-date-picker` or `dl-input type="date"` that renders a consistent calendar popover.

### 2.7 `dl-dialog` — confirmation variant — **P1**

`dl-dialog` exists (great for the big modal). We still use native `window.confirm("Delete this photo?")` in [src/app/property/[id]/page.tsx](src/app/property/[id]/page.tsx) because opening a full `dl-dialog` for a simple yes/no feels heavy.

**Suggested:** `dl-confirm` helper or an imperative `dlConfirm({ title, body, danger: true })` that returns a Promise<boolean>. Every admin app destroys things; a branded confirm is table stakes.

### 2.8 `dl-tooltip` — **P1**

There's no tooltip primitive. On [src/app/property/[id]/page.tsx](src/app/property/[id]/page.tsx) we use `title` attributes for photo reorder buttons (`title="Move up"`) which is native-browser behavior — inconsistent delay, no keyboard, not touch-friendly.

**Suggested:** `dl-tooltip` with slot-based triggering, escape-to-close, positioning variants.

### 2.9 `dl-breadcrumb` / `dl-app-bar` — **P2**

Every admin page has a "← Back to Dashboard" button hand-placed at the bottom ([src/app/admin/properties/page.tsx:282](src/app/admin/properties/page.tsx), [src/app/admin/dashboard/page.tsx:118](src/app/admin/dashboard/page.tsx), etc.). A `dl-app-bar` with a `back` prop + title + optional action slot would collapse ~6 repeated blocks.

### 2.10 `dl-pill-toggle` / segmented control — **P2**

For the filter chips (All / Active / Pending / Sold / Withdrawn) we built a custom `<Chips>` component. A native `dl-segmented` with radio-group semantics and keyboard arrow navigation would be reusable everywhere.

### 2.11 `dl-chart-sparkline` — **P2**

We built an SVG `Sparkline` ([src/components/buyer/Sparkline.tsx](src/components/buyer/Sparkline.tsx)) and a larger `PriceChart` ([src/app/property/[id]/page.tsx](src/app/property/[id]/page.tsx)). Any app showing trends will reinvent this.

**Suggested:** a tiny `dl-sparkline values="100,110,105,120"` + `dl-line-chart` with markers.

### 2.12 `dl-file-dropzone` — **P2**

[src/app/property/[id]/page.tsx](src/app/property/[id]/page.tsx) hand-rolls the drag-and-drop zone (`onDragOver`, `onDragLeave`, `onDrop`, active-state styling). Would be a natural wrapper around `<input type="file">`.

---

## 3. Inconsistencies worth documenting (no new code, just docs)

### 3.1 `dl-text color="tertiary"` is muted/secondary, not an error color

We accidentally used `color="tertiary"` for error text across five admin files because the name sounds like "a third semantic color" — but it's just a muted tone. The actual error color is `color="danger"`. This caused visible-but-wrong error rendering (gray instead of red) until we caught it.

**Suggested:** rename in the docs, or alias `tertiary` → `muted`, and make it clearer that `danger` is the error color.

### 3.2 `dl-button variant="danger"` exists but `dl-text color="danger"` is the only way to color inline text red

Inconsistent naming: the **button** has a danger variant; the **text** uses the same token but via `color`. Small thing, but consumers flip-flop.

### 3.3 `full-width` vs `fullWidth` vs `full_width`

`<dl-button full-width>` requires the kebab-case attribute. Our test setup stubs React-attribute casing for web components. Worth a one-liner in the docs on which form works in React JSX.

---

## 4. What we're doing instead of filing bugs upstream

Short-term we've bundled the workarounds into:
- [src/components/Toast.tsx](src/components/Toast.tsx)
- [src/components/EmptyState.tsx](src/components/EmptyState.tsx)
- [src/components/Skeleton.tsx](src/components/Skeleton.tsx)
- [src/components/formControlStyles.ts](src/components/formControlStyles.ts) — shared `controlBase`, `selectBase`, `smallSelectBase`
- [src/dlite-design-system/styles.css](src/dlite-design-system/styles.css) — `.form-row`, `.form-grid`, `.header-row` media queries

Each of these would ideally go away once dlite covers the gap natively.

---

## 5. Priority ranking (what to do first if resources are tight)

| Rank | Item | Package |
|---|---|---|
| 1 | Pseudo-class utility variants (`hover:`, `focus-visible:`) | `style-dictionary-dlite-tokens` |
| 2 | `dl-toast` component | `web-components-dlite` |
| 3 | Responsive breakpoint prefixes (`sm:`, `md:`, `lg:`) | `style-dictionary-dlite-tokens` |
| 4 | Color scales (blue-100…900, etc.) + soft-badge token group | both |
| 5 | `dl-select` / `dl-input[type="date"]` styling parity | `web-components-dlite` |
| 6 | `dl-empty-state`, `dl-skeleton`, `dl-chip-group` | `web-components-dlite` |
| 7 | Grid-template-column utilities | `style-dictionary-dlite-tokens` |
| 8 | Z-index named scale | `style-dictionary-dlite-tokens` |
| 9 | `dl-confirm` imperative helper | `web-components-dlite` |
| 10 | `dl-date-picker` | `web-components-dlite` |
