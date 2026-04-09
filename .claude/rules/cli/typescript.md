---
paths:
  - "packages/cli/**/*.ts"
---

# TypeScript

- Interface names MUST start with `I` (e.g., `IFooInput`, `IFooOutput`)
- ALWAYS define named interfaces for function inputs and outputs — never inline object types
- NEVER use `Bun.sleep` — use the internal `sleep` utility
