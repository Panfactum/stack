---
paths:
  - "packages/cli/**/*.ts"
---

# TSDoc

- Before writing or analyzing TSDoc, get the updated schema from Context7
- ALWAYS write and keep current TSDoc on exported functions, classes, Zod schemas, and interfaces
- ALWAYS update TSDoc when modifying the relevant code
- Use `@remarks`, `@param`, `@returns`, `@throws`, `@example`, `@see` as applicable
- Reference input/output interfaces in `@param`/`@returns` using `{@link}`
- `@throws` format: `@throws {@link FooError}\nThrows when ...`
- Internal helpers: use `@internal` tag with lighter documentation
