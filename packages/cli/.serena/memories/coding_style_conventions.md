# Coding Style and Conventions

## TypeScript Conventions

### Naming Rules
- **Interfaces**: Must start with `I` (e.g., `IExecuteInputs`, `IAWSConfig`)
- **Classes**: PascalCase (e.g., `CLIError`, `AWSClient`)
- **Functions/Variables**: camelCase with descriptive names
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Files**: camelCase for .ts files

### Type Safety
- **NEVER use `any`** - use `unknown` if type is truly unknown
- **NEVER use non-null assertion (`!`)**
- **Always create interfaces** for function inputs/outputs - no inline types
- **Use Zod schemas** for all external data validation

### Documentation Requirements
All exported functions must have TSDoc comments:
```typescript
/**
 * Brief description of the function
 *
 * @remarks
 * Additional context or implementation details
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {@link CLIError} When specific error occurs
 * @example
 * ```typescript
 * const result = await functionName({ param: 'value' });
 * ```
 * @see {@link relatedFunction}
 */
```

Internal functions can use simplified documentation with `@internal` tag.

### Error Handling
- **Never use generic `Error`** - always use custom error classes
- Primary error class: `CLIError` with proper error codes
- Always document thrown errors with `@throws`

### AWS Best Practices
- Always use AWS SDK v3, never AWS CLI calls
- Use client generators in `src/util/aws/clients/`
- Cache clients for reuse
- Handle AWS errors with proper error codes

### Code Organization
- One exported function/class per file preferred
- Group related utilities in subdirectories
- Keep imports organized (enforced by ESLint)
- No circular dependencies

### Other Rules
- No console.log (use console.warn/error/info)
- Prefer async/await over promises
- Use early returns to reduce nesting
- Keep functions focused and small
- Always validate external inputs with Zod