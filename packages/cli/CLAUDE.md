# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Building and Development**
```bash
# Build binary (outputs to ./bin/pf)
bun run build:binary

# Type checking
bun run check

# Linting
bun run lint       # Check for lint errors
bun run lint:fix   # Auto-fix lint errors

# Testing
bun run test       # Run all tests
bun run test:watch # Run tests in watch mode
```

## Architecture Overview

### Core Structure
This is a Bun-based CLI application built with TypeScript and the Clipanion framework. The CLI manages infrastructure deployments across AWS and Kubernetes.

**Command Architecture**: All commands extend `PanfactumCommand` (located in `src/util/command/panfactumCommand.ts`), which provides:
- Error handling with `CLIError` and detailed stack traces
- Debug logging via `--debug` flag
- Access to `PanfactumContext` containing logger and repo variables

**Command Registration**: Commands are registered in `src/index.ts` and follow this pattern:
```typescript
cli.register(YourCommand);
```

### Key Patterns

**Asynchronous Task Management**: Uses Listr2 for complex multi-step operations. See `src/commands/cluster/add/command.ts` for a comprehensive example with:
- Step definitions in `SETUP_STEPS` array
- Progress tracking via `completed` flag
- Module-based completion detection

**Terragrunt Integration**: Infrastructure deployment through Terragrunt wrappers in `src/util/terragrunt/`:
- Operations: `terragruntApply`, `terragruntInit`, `terragruntImport`, etc.
- Module paths: `environments_dir/<environment>/<region>/<module>`
- Non-interactive mode with colored output suppression

**AWS Operations**: Centralized in `src/util/aws/` with:
- Client factories: `getSTSClient()`, `getS3Client()`, etc.
- Profile management: `getAWSProfiles()`, `addAWSProfileFromStaticCreds()`
- Credential handling: `getCredsFromFile()`, `getIdentity()`

**Configuration Management**:
- Environment configs: `src/util/config/` with schemas defined using Zod
- YAML file operations: `src/util/yaml/`
- SOPS encryption: `src/util/sops/`

### Error Handling
Use `CLIError` for user-facing errors with detailed messages:
```typescript
throw new CLIError('User-friendly message', { 
  cause: originalError 
});
```

### File Structure Conventions
- Commands: `src/commands/<category>/<action>/command.ts`
- Utilities: `src/util/<category>/<function>.ts`
- Templates: `src/templates/<module>.hcl`
- Files: `src/files/<category>/<file>`

### Testing
Currently no test files in `src/`, but the test infrastructure is set up for `bun test` with pattern `src/**/*.test.ts`.

### Environment Variables
- `VERSION`: Injected at build time from package.json
- AWS credentials and profiles managed through standard AWS SDK mechanisms

### Key Dependencies
- `clipanion`: CLI framework for command parsing and execution
- `listr2`: Task runner for complex operations
- `picocolors`: Terminal colorization (blue=info, magenta=prompts, red=errors, cyan=actions, green=success)
- `@aws-sdk/*`: AWS service clients
- `terragrunt`: Infrastructure deployment (not a direct dependency, expected in environment)