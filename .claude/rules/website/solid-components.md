---
paths:
  - "packages/website/src/**/*.tsx"
---

# SolidJS Components

- NEVER use a default export for a component
- NEVER import an Astro component into a SolidJS component
- Define components as anonymous functions typed as `Component` or `ParentComponent`
- ALWAYS define a discrete interface for props (e.g., `IMyComponentProps`)
- ALWAYS use `clsx` (named import) for class string concatenation — never ternaries or template strings
- ALWAYS use Tailwind classes; fallback to CSS modules
- Images: import the file and render with `Image` from `@unpic/solid` — never `<img>` or remote URLs
- Prefer CSS states (`:hover`) over mouse event handlers (`onMouseEnter`, `onMouseLeave`)
