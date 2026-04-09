---
paths:
  - "packages/cli/src/**/*.ts"
---

# Data Handling

## Validation
- ALWAYS validate external input/output with Zod schemas

## Filesystem
- Use utilities from `src/util/fs/` — never `node:fs/promises`, `Bun.file`, or `Bun.write` directly

## YAML
- Use utilities from `src/util/yaml/` (`readYAMLFile`, `writeYAMLFile`) — never raw file methods
- YAML keys written to files MUST be `snake_case`

## SOPS
- Use utilities from `src/util/sops/` for all sops-encrypted files
