---
paths:
  - "packages/cli/**/*.test.ts"
---

# Testing

- Test file naming: `[original_file].test.ts`
- Wrap every `test` in a `describe` block
- Use inline snapshots for object assertions (`toMatchInlineSnapshot`), indented 4 spaces from `expect`
- NEVER use global `mock.module()` — use `spyOn` inside `beforeEach`/`afterEach`; call `mock.restore()` in `afterEach`
- Use `createTestDir` from `@/util/test/createTestDir` for filesystem tests; always clean up in `afterEach`
- Never mock filesystem IO — create real temporary files
