# Suggested Development Commands

## Package Management (CLI)
```bash
# Install dependencies
bun install

# Run development commands from packages/cli
cd packages/cli
```

## Linting and Type Checking
```bash
# Type check CLI code
bun run typecheck

# Lint CLI code
bun run lint

# Fix linting issues
bun run lint:fix

# Format code with prettier
bun run format
```

## Testing
```bash
# Run tests
bun test

# Run tests in watch mode
bun test:watch
```

## Building
```bash
# Build the CLI
bun run build

# Install/link the CLI globally for testing
bun link
```

## Pre-commit Validation
```bash
# CLI specific pre-commit checks
precommit-typecheck-cli  # Type checking
precommit-lint-cli      # ESLint validation

# Other pre-commit checks
cspell lint --no-progress --gitignore <file>  # Spellcheck markdown
shellcheck <file>       # Shell script validation
shfmt --diff -i 2 <file>  # Shell script formatting
```

## Git Commands
```bash
# Always rebase when pulling
git pull --rebase

# Never use --no-verify when committing!
git commit -m "message"  # Let pre-commit hooks run
```

## System Utilities
```bash
# Common Linux commands
ls -la              # List files with details
grep -r "pattern"   # Search recursively
find . -name "*.ts" # Find files by pattern
```

## Important Notes
- NEVER use `--no-verify` when committing
- Always run type checking and linting before committing
- Pre-commit hooks will run automatically on commit
- Use the execute utility for subprocess calls, never spawn/exec directly