---
paths:
  - "packages/website/src/**/*.astro"
---

# Astro Components

- Every `index.astro` page MUST use a layout from `src/components/layouts/`:
  - Docs pages → `layouts/docs/Layout.astro`
  - Marketing pages → `layouts/primary/Layout.astro`
- AVOID `<script>` blocks for interactivity — use a SolidJS component instead
- Use Tailwind classes; fallback to [Scoped Styles](https://docs.astro.build/en/guides/styling/#scoped-styles)
- Single-use components: store in `_components/` adjacent to the page's `index.astro`
- Reusable components: store under `src/components/`
