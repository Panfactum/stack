---
paths:
  - "packages/cli/**"
---

# Commands

- NEVER run `eslint` or `tsc` directly as this will cause module resolution problems — use `bunx <command>`
- NEVER use `npm`, `yarn`, or `pnpm` in the cli project — always use `bun`
