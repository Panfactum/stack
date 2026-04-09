---
paths:
  - "packages/cli/src/**/*.ts"
---

# CLI Patterns

## Errors
- NEVER use `Error` — use custom error classes from `src/util/error/error.ts` (e.g., `CLIError`, `CLISubprocessError`)

## Logging & Prompts
- ALL output and user prompts MUST go through `PanfactumContext.logger` — never `console.log` or raw Inquirer methods
- Before writing Inquirer prompts, always look up the appropriate syntax using exa

## Subprocess Execution
- NEVER use `spawn`, `exec`, or `execSync` — ALWAYS use the `execute` utility from `src/util/subprocess/execute.ts`

## Linting
- Lint individual files: `bun eslint --fix [file_path]`
- NEVER disable eslint rules without confirming with the user
