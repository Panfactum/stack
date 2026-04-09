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
- NEVER use `spawn`, `exec`, or `execSync` — ALWAYS launch subprocesses via `SubprocessManager.execute()` from `src/util/subprocess/SubprocessManager.ts`
- Access the `SubprocessManager` instance through `PanfactumContext` — never instantiate it directly

## Linting
- Lint individual files: `bun eslint --fix [file_path]`
- NEVER disable eslint rules without confirming with the user
