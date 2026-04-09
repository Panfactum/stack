---
paths:
  - "packages/website/src/**/*.{astro,tsx,css}"
---

# Styling

- ALWAYS use Tailwind classes over inline styles or custom stylesheets
- Use semantic utilities from `src/styles/utilities/`:
  - `colors.css` — `bg-primary`, `bg-secondary`, `text-primary`, `border-primary`, etc.
  - `textSizes.css` — `text-display-2xl` through `text-display-xs`
- PREFER semantic utility classes over raw Tailwind values (e.g., `bg-primary` not `bg-gray-dark-mode-950`)
- There is NO dark mode — NEVER use the `dark:` variant
- Store component images in an `images/` directory adjacent to the component — NEVER in `public/`
