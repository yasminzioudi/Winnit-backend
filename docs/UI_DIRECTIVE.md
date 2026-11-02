# UI/UX directive (applies to every frontend phase)

Goal: premium fintech-grade UI, not a template. Extend the existing design system (tokens in globals.css via @theme); never restyle the shell.

## Performance first

- Skeletons matching the final layout, no layout shift (CLS < 0.1).

- Prefetch on hover/focus, keepPreviousData for filters, optimistic updates for status changes.

- Charts and workers lazy-loaded; no heavy library in the first-load bundle.

## Motion

- Count-up numbers, animated waterfall reveal, shimmer, hover lift, smooth tab transitions (View Transitions API when available).

- CSS/rAF only, no animation library. Respect prefers-reduced-motion.

## Visual rules

- Tokens only, no hard-coded colors. Dark-mode parity for every chart.

- Money in the mono font with tabular-nums, formatted like "16 420 TND" via lib/format.

- Intentional at 390px, 768px and 1440px. Mobile-first: bottom tab bar and bottom sheets for forms.

## Accessibility

- WCAG AA contrast, touch targets >= 44px, visible focus, keyboard shortcuts (g then o/c/w/s, n = new order, / = search, ? = cheat-sheet).

## States

- Polished empty states (inline SVG + primary CTA), human French error states with retry, success toasts, undoable destructive actions (soft delete with undo toast).

## Language

- French UI copy, English code.
