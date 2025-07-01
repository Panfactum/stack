# CLI Architecture and Patterns

## Command Structure

The Panfactum CLI uses Clipanion framework with hierarchical command organization:

```
packages/cli/src/commands/
├── aws/          # AWS-related commands
├── cluster/      # Kubernetes cluster management
├── config/       # Configuration management
├── env/          # Environment operations
├── iac/          # Infrastructure as Code commands
├── kube/         # Kubernetes operations
├── vault/        # HashiCorp Vault integration
└── ...           # Other command groups
```

## Key Architectural Patterns

### 1. Command Implementation
```typescript
export default class CommandName extends PanfactumCommand {
  static paths = [['command', 'subcommand']];
  
  option = Option.String('-o,--option', { description: '...' });

  async execute(): Promise<number | void> {
    // Implementation
  }
}
```

### 2. Subprocess Execution
**ALWAYS** use the execute utility:
```typescript
import execute from '@/util/subprocess/execute';

const result = await execute({
  command: 'command',
  args: ['arg1', 'arg2'],
  cwd: '/path',
  env: { KEY: 'value' }
});
```

### 3. AWS Client Pattern
```typescript
import getEC2Client from '@/util/aws/clients/getEC2Client';

const client = await getEC2Client(region, profile);
```

### 4. Error Handling
```typescript
import CLIError from '@/util/error/error';

throw new CLIError({
  message: 'Descriptive error message',
  code: 'ERROR_CODE'
});
```

### 5. Data Validation
```typescript
import { z } from 'zod';

const schema = z.object({
  field: z.string().min(1)
});

const validated = schema.parse(input);
```

## Utility Organization

```
packages/cli/src/util/
├── aws/          # AWS SDK utilities and clients
├── config/       # Configuration management
├── context/      # CLI context and logging
├── error/        # Error handling
├── kube/         # Kubernetes utilities
├── subprocess/   # Process execution
└── terragrunt/   # Terragrunt operations
```

## Important Implementation Notes

1. **No Direct Process Spawning**: Always use execute utility
2. **Client Caching**: AWS clients are cached for performance
3. **Schema Validation**: All external data must be validated
4. **Error Codes**: Use consistent error codes for debugging
5. **Async First**: Prefer async/await patterns
6. **Type Safety**: Full TypeScript strictness enforced