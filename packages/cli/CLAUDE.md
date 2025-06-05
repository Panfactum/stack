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

**Architecture Notes**:
- Built with Bun and TypeScript using Clipanion framework
- All commands extend `PanfactumCommand` for consistent error handling
- Uses Listr2 for complex multi-step operations
- Integrates with Terragrunt for infrastructure deployment
- AWS SDK for cloud operations
- Configuration managed via YAML files with SOPS encryption

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
Never use Error. Always use one of our custom error classes such as CLIError.

Use `CLIError` for user-facing errors with detailed messages:
```typescript
throw new CLIError('User-friendly message', { 
  cause: originalError 
});
```

### Data Validation
**ALWAYS use Zod schema validation for all external input and output**, especially when using `execute` to call external scripts like `kubectl`. This ensures type safety and data integrity throughout the CLI:

```typescript
import { z } from 'zod';

const KubectlOutputSchema = z.object({
  metadata: z.object({
    name: z.string(),
    namespace: z.string()
  })
});

// Validate external command output
const result = await execute('kubectl', ['get', 'pod', '-o', 'json']);
const validated = KubectlOutputSchema.parse(JSON.parse(result.stdout));
```

### Subprocess Execution
**NEVER use `spawn`, `exec`, or `execSync` from Node.js. ALWAYS use the `execute` utility** from `src/util/subprocess/execute.ts`. This provides:
- Consistent error handling with `CLISubprocessError`
- Proper logging and debug output
- Retry capabilities with configurable delays
- Stream handling for real-time output processing
- Standardized environment variable handling

```typescript
import { execute } from '@/util/subprocess/execute';

// Good: Use execute utility
const result = await execute({
  command: ['vault', 'token', 'lookup', '-format=json'],
  context,
  workingDirectory: process.cwd(),
  env: { ...process.env, VAULT_ADDR: vaultAddr }
});

// Bad: Never use these
// execSync('vault token lookup -format=json');
// spawn('vault', ['token', 'lookup']);
// exec('vault token lookup');
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

## CLI Migration Patterns

### Migrating Legacy Scripts
When migrating bash scripts from `packages/nix/packages/scripts/pf-*.sh` to CLI commands:

1. **Command Structure**: Convert from `pf-command-name` to `pf command name` (replace hyphens with spaces)
2. **Container Usage**: In Terraform modules, update from `/bin/pf-command-name` to `["pf", "command", "name"]`
3. **Behavior Parity**: Ensure CLI commands replicate all functionality including:
   - Default values and warnings for missing data
   - Same kubectl operations and arguments
   - Error handling (though CLI provides better structure)
4. **Output Differences**: 
   - Bash scripts use stderr (`>&2`), CLI uses logger methods
   - CLI can add helpful summaries that scripts didn't have
   - kubectl output is captured but not displayed (available in debug mode)

### Example Migration
```bash
# Old: /bin/pf-voluntary-disruptions-enable --namespace=foo --window-id=bar
# New: pf k8s disruptions enable --namespace=foo --window-id=bar

# In Terraform:
# Old: command = ["/bin/pf-voluntary-disruptions-enable", "--namespace=${var.namespace}", "--window-id=${var.id}"]
# New: command = ["pf", "k8s", "disruptions", "enable", "--namespace=${var.namespace}", "--window-id=${var.id}"]
```