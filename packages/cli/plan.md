# Migration Plan: pf-get-local-module-hash and pf-get-commit-hash

## Overview

This document outlines the detailed migration plan for moving `pf-get-local-module-hash.sh` and `pf-get-commit-hash.sh` from the Nix package to the CLI package as part of the broader effort to consolidate all Panfactum functionality into a single binary.

## Scripts to Migrate

### 1. pf-get-local-module-hash.sh
- **Purpose**: Generates SHA1 hash of Terraform module contents for cache invalidation
- **Current Location**: `packages/nix/packages/scripts/pf-get-local-module-hash.sh`
- **Dependencies**: find, sort, sha1sum, xargs, realpath, cut

### 2. pf-get-commit-hash.sh
- **Purpose**: Resolves git references (branches, tags, commits) to commit SHAs
- **Current Location**: `packages/nix/packages/scripts/pf-get-commit-hash.sh`
- **Dependencies**: git, getopt

## Migration Architecture

### Command Structure

```
pf util get-module-hash [module-path]
pf util get-commit-hash --repo <repo> --ref <ref> [--no-verify]
```

### Shared Utilities Approach

Since these are utilities used by other commands, they should be:
1. Implemented as reusable functions in a utilities module
2. Exposed as CLI commands for backward compatibility
3. Callable directly from other CLI commands without spawning subprocesses

### Directory Structure

```
packages/cli/src/
├── commands/
│   └── util/
│       ├── get-module-hash/
│       │   └── command.ts
│       └── get-commit-hash/
│           └── command.ts
└── lib/
    └── utilities/
        ├── module-hash.ts    # Core logic for module hashing
        └── git.ts            # Git utilities including commit resolution
```

## Implementation Details

### 1. pf-get-local-module-hash Migration

#### Core Function (lib/utilities/module-hash.ts)
```typescript
import { createHash } from 'crypto';
import { glob } from 'glob';
import { readFile } from 'fs/promises';
import path from 'path';

export async function getModuleHash(modulePath: string): Promise<string> {
  if (!modulePath) {
    return '';
  }

  const absolutePath = path.resolve(modulePath);
  
  // Find all files (excluding hidden files)
  const files = await glob('**/*', {
    cwd: absolutePath,
    nodir: true,
    dot: false,
    ignore: ['.*', '**/.*']
  });

  if (files.length === 0) {
    return '';
  }

  // Sort files for consistent ordering
  files.sort();

  // Calculate hash for each file
  const hashes: string[] = [];
  for (const file of files) {
    const filePath = path.join(absolutePath, file);
    const content = await readFile(filePath);
    const hash = createHash('sha1').update(content).digest('hex');
    hashes.push(`${hash}  ${file}`);
  }

  // Calculate final hash
  const combinedContent = hashes.join('\n');
  return createHash('sha1').update(combinedContent).digest('hex');
}
```

#### CLI Command (commands/util/get-module-hash/command.ts)
```typescript
import { PanfactumCommand } from '../../../lib/command.js';
import { getModuleHash } from '../../../lib/utilities/module-hash.js';

export default class GetModuleHashCommand extends PanfactumCommand {
  static override paths = [['util', 'get-module-hash']];

  static override usage = PanfactumCommand.Usage({
    description: 'Generate SHA1 hash of Terraform module contents',
    category: 'Utilities',
  });

  modulePath = Option.String({ required: false });

  async execute(): Promise<number> {
    const hash = await getModuleHash(this.modulePath || '');
    if (hash) {
      this.context.stdout.write(hash);
    }
    return 0;
  }
}
```

### 2. pf-get-commit-hash Migration

#### Core Function (lib/utilities/git.ts)
```typescript
import { execute } from '../exec.js';

export interface GetCommitHashOptions {
  repo?: string;
  ref?: string;
  noVerify?: boolean;
}

export async function getCommitHash(options: GetCommitHashOptions = {}): Promise<string> {
  const { repo = 'origin', ref, noVerify = false } = options;

  // Special case: local ref
  if (ref === 'local') {
    return 'local';
  }

  // If no ref and repo is origin, get current HEAD
  if (!ref && repo === 'origin') {
    const { stdout } = await execute('git', ['rev-parse', 'HEAD']);
    return stdout.trim();
  }

  // If ref is provided
  if (ref) {
    // Check if it's already a 40-char SHA
    if (/^[0-9a-f]{40}$/i.test(ref)) {
      if (!noVerify && repo === 'origin') {
        // Verify the commit exists
        try {
          await execute('git', ['rev-parse', '--verify', `${ref}^{commit}`]);
        } catch {
          throw new Error(`Commit ${ref} does not exist in repository`);
        }
      }
      return ref;
    }

    // Resolve the ref
    if (repo === 'origin') {
      try {
        const { stdout } = await execute('git', ['rev-parse', `${ref}^{commit}`]);
        return stdout.trim();
      } catch {
        throw new Error(`Could not resolve ${ref} to a commit`);
      }
    } else {
      // Remote repository
      const { stdout } = await execute('git', ['ls-remote', repo, ref]);
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        const [hash, refName] = line.split('\t');
        if (refName === ref || refName === `refs/heads/${ref}` || refName === `refs/tags/${ref}`) {
          return hash;
        }
      }
      
      throw new Error(`Could not find ref ${ref} in repository ${repo}`);
    }
  }

  throw new Error('Either ref must be provided or repo must be origin');
}
```

#### CLI Command (commands/util/get-commit-hash/command.ts)
```typescript
import { Option } from 'clipanion';
import { PanfactumCommand } from '../../../lib/command.js';
import { getCommitHash } from '../../../lib/utilities/git.js';

export default class GetCommitHashCommand extends PanfactumCommand {
  static override paths = [['util', 'get-commit-hash']];

  static override usage = PanfactumCommand.Usage({
    description: 'Resolve git references to commit SHAs',
    category: 'Utilities',
  });

  repo = Option.String('-r,--repo', 'origin', {
    description: 'Git repository (defaults to origin/current repo)',
  });

  ref = Option.String('-c,--ref', {
    description: 'Git reference to resolve (commit, branch, tag, or "local")',
  });

  noVerify = Option.Boolean('-n,--no-verify', false, {
    description: 'Skip verification that commit exists',
  });

  async execute(): Promise<number> {
    try {
      const hash = await getCommitHash({
        repo: this.repo,
        ref: this.ref,
        noVerify: this.noVerify,
      });
      this.context.stdout.write(hash);
      return 0;
    } catch (error) {
      this.throwError(error instanceof Error ? error.message : 'Failed to resolve commit hash');
    }
  }
}
```

## Integration with Existing Commands

### Update Internal Usage

Other CLI commands that need these utilities can import and use them directly:

```typescript
// Example in another command
import { getModuleHash } from '../../../lib/utilities/module-hash.js';
import { getCommitHash } from '../../../lib/utilities/git.js';

// Use directly without spawning subprocess
const moduleHash = await getModuleHash(modulePath);
const commitHash = await getCommitHash({ ref: 'main' });
```

### Backward Compatibility

The shell scripts will be updated to call the CLI:

```bash
#!/usr/bin/env bash
# pf-get-local-module-hash.sh
exec pf util get-module-hash "$@"
```

```bash
#!/usr/bin/env bash
# pf-get-commit-hash.sh
exec pf util get-commit-hash "$@"
```

## Testing Strategy

### Unit Tests

1. **Module Hash Tests** (`lib/utilities/module-hash.test.ts`)
   - Test with empty directory
   - Test with single file
   - Test with multiple files
   - Test with nested directories
   - Test deterministic output (same files = same hash)

2. **Git Utilities Tests** (`lib/utilities/git.test.ts`)
   - Test resolving branch names
   - Test resolving tag names
   - Test validating commit SHAs
   - Test "local" special case
   - Test remote repository resolution
   - Test error cases (invalid refs, non-existent commits)

### Integration Tests

1. Test the CLI commands with various inputs
2. Test error handling and output formatting
3. Test that other commands can successfully use these utilities

## Migration Steps

### Phase 1: Implementation
1. Create the utility modules with core logic
2. Create the CLI command wrappers
3. Add comprehensive unit tests
4. Add integration tests

### Phase 2: Integration
1. Update any CLI commands that need these utilities to use the new functions
2. Test all dependent functionality
3. Update shell script wrappers for backward compatibility

### Phase 3: Validation
1. Run full test suite
2. Test in development environment
3. Verify backward compatibility with existing scripts
4. Performance testing (ensure no regression vs shell scripts)

### Phase 4: Cleanup
1. Mark shell scripts as deprecated
2. Update documentation
3. Plan for eventual removal of shell scripts

## Performance Considerations

### Module Hash Performance
- The TypeScript implementation should match or exceed shell script performance
- Use streaming for large files to avoid memory issues
- Consider caching for repeated calls to the same module

### Git Operations Performance
- Git commands are already reasonably fast
- Avoid repeated git calls by caching results where appropriate
- Consider using libgit2 bindings for better performance in the future

## Error Handling

Both commands should follow the CLI's error handling patterns:
- Use `CLIError` for user-facing errors
- Provide clear, actionable error messages
- Exit with appropriate error codes
- Log debug information when verbose mode is enabled

## Documentation Updates

1. Update CLI documentation to include new `util` commands
2. Add examples of using these utilities
3. Document the migration for users of the shell scripts
4. Update any references in the main documentation

## Success Criteria

1. All functionality from shell scripts is preserved
2. Error handling is improved with better messages
3. Other CLI commands can use these utilities without subprocess overhead
4. Backward compatibility is maintained via wrapper scripts
5. All tests pass
6. Documentation is complete and accurate