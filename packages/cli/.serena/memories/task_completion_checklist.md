# Task Completion Checklist

When completing any coding task in the Panfactum CLI, **ALWAYS** perform these steps:

## 1. Code Quality Checks

### Type Checking (REQUIRED)
```bash
cd packages/cli
bun run typecheck
```
Fix any TypeScript errors before proceeding.

### Linting (REQUIRED)
```bash
cd packages/cli
bun run lint
```
Fix all ESLint errors. Use `bun run lint:fix` for auto-fixable issues.

### Formatting
```bash
cd packages/cli
bun run format
```

## 2. Documentation Verification

- Ensure all exported functions have complete TSDoc comments
- Verify `@param`, `@returns`, `@throws`, and `@example` sections
- Check that error classes are properly linked with `{@link}`

## 3. Testing

If tests exist for modified code:
```bash
cd packages/cli
bun test
```

## 4. Pre-commit Validation

The following hooks will run automatically on commit:
- **typecheck-cli**: TypeScript validation
- **lint-cli**: ESLint validation
- **spellcheck**: For markdown files
- **shellcheck/shfmt**: For shell scripts

## 5. Final Checklist

Before marking task complete:
- [ ] No TypeScript errors (`bun run typecheck`)
- [ ] No ESLint errors (`bun run lint`)
- [ ] All exported functions documented with TSDoc
- [ ] No use of `any` type or `!` operator
- [ ] All errors use `CLIError` or custom error classes
- [ ] Zod schemas used for external data validation
- [ ] Interface names start with `I`
- [ ] No direct use of spawn/exec (use execute utility)

## Important Reminders

- **NEVER use `--no-verify`** when committing
- If unable to find lint/typecheck commands, ask user before proceeding
- Suggest adding commands to CLAUDE.md if discovered