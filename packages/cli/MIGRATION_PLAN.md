# Panfactum CLI Migration Plan

This document outlines the migration strategy for moving shell scripts from `packages/nix/packages/scripts/` to TypeScript CLI commands in `packages/cli/`.

## Current CLI Architecture

### Command Structure Pattern
```
pf <category> <action> [options]
```

### Existing Commands
- `pf aws profiles list`
- `pf aws vpc-network-test` (placeholder)
- `pf cluster add`
- `pf cluster enable`
- `pf config get`
- `pf devshell sync`
- `pf domain add`
- `pf domain remove`
- `pf env add`
- `pf env remove`
- `pf iac update-module-status`
- `pf sso add`
- `pf welcome`

### Command Framework
- **Base Class**: `PanfactumCommand` (extends Clipanion's `Command`)
- **Context**: `PanfactumContext` with shared state and utilities
- **Error Handling**: Centralized via `CLIError` class
- **File Structure**: `/src/commands/<category>/<action>/command.ts`

## Migration Strategy

### Phase 1: Core Utilities (No Dependencies)
Migrate foundational scripts that other scripts depend on. These become shared utilities rather than CLI commands.

#### 1.1 Configuration & Repository Management
```typescript
// Convert to shared utilities (not CLI commands)
pf-get-repo-variables.sh    → src/util/config/getRepoVariables.ts (✅ exists)
pf-get-open-port.sh         → src/util/network/getOpenPort.ts (✅ exists)
pf-get-local-module-hash.sh → src/util/crypto/getModuleHash.ts (✅ exists)
pf-get-commit-hash.sh       → src/util/git/getCommitHash.ts (✅ exists)
```

#### 1.2 Independent CLI Commands
```typescript
// Direct CLI command mappings
pf-tf-init.sh                          → pf terraform init (✅ exists)
pf-sops-set-profile.sh                 → pf sops set-profile <directory> <profile> (✅ exists)
wait-on-image.sh                       → pf aws ecr wait-on-image <image> (✅ exists)
pf-velero-snapshot-gc.sh               → pf k8s velero snapshot-gc (✅ exists)
pf-voluntary-disruptions-disable.sh    → pf k8s disruptions disable (✅ exists)
pf-voluntary-disruptions-enable.sh     → pf k8s disruptions enable (✅ exists)
enter-shell-local.sh                   → pf devshell enter (or integrate into existing sync) (✅ exists)
```

### Phase 2: Authentication & Secrets
Build on core utilities to provide authentication services.

#### 2.1 Shared Authentication Services
```typescript
// Convert to shared utilities
pf-get-vault-token.sh → src/util/vault/getToken.ts (✅ exists)
pf-get-db-creds.sh    → src/util/vault/getDbCreds.ts (✅ exists)
```

#### 2.2 CLI Commands
```typescript
pf-get-aws-profile-for-kube-context.sh → pf aws profile-for-context <context> (✅ exists)
```

### Phase 3: Infrastructure Management
Commands that depend on authentication and core utilities.

#### 3.1 Terraform/Infrastructure
```typescript
pf-tf-delete-locks.sh → pf terraform delete-locks [--profile] [--table] [--region] (✅ exists)
```

#### 3.2 Network & Tunneling
```typescript
pf-tunnel.sh        → pf tunnel <service> <port> [--namespace] (✅ exists)
pf-vpc-network-test.sh → pf aws vpc-network-test --module-path <path> (✅ placeholder exists)
```

### Phase 4: Container & Build Management
BuildKit operations with complex dependency chains.

#### 4.1 Shared BuildKit Services
```typescript
// Convert to shared utilities
pf-buildkit-validate.sh     → src/util/buildkit/validate.ts
pf-buildkit-get-address.sh  → src/util/buildkit/getAddress.ts
pf-buildkit-record-build.sh → src/util/buildkit/recordBuild.ts
```

#### 4.2 BuildKit CLI Commands
```typescript
pf-buildkit-build.sh       → pf buildkit build <dockerfile> <context> <tags...>
pf-buildkit-clear-cache.sh → pf buildkit clear-cache
pf-buildkit-scale-down.sh  → pf buildkit scale down [--timeout]
pf-buildkit-scale-up.sh    → pf buildkit scale up [--arch]
pf-buildkit-tunnel.sh      → pf buildkit tunnel [--arch]
```

### Phase 5: Advanced Operations
Complex commands with multiple dependencies.

#### 5.1 Database Operations
```typescript
pf-db-tunnel.sh → pf db tunnel [--namespace] [--type postgresql|redis|nats]
```

#### 5.2 Kubernetes Management
```typescript
pf-eks-suspend.sh → pf k8s cluster suspend [--cluster]
pf-eks-resume.sh  → pf k8s cluster resume [--cluster]
```

#### 5.3 Docker Integration
```typescript
docker-credential-panfactum.sh → pf docker credential-helper <action>
```

#### 5.4 CI/CD Operations
```typescript
pf-wf-git-checkout.sh → pf workflow git-checkout <ref> <directory>
```

## Proposed Command Structure

### Top-Level Categories
```
pf aws <subcommand>         # AWS operations
pf buildkit <subcommand>    # Container building
pf cluster <subcommand>     # Kubernetes cluster management (✅ exists)
pf config <subcommand>      # Configuration management (✅ exists)
pf db <subcommand>          # Database operations
pf devshell <subcommand>    # Development environment (✅ exists)
pf docker <subcommand>      # Docker operations
pf domain <subcommand>      # Domain management (✅ exists)
pf env <subcommand>         # Environment management (✅ exists)
pf git <subcommand>         # Git operations
pf iac <subcommand>         # Infrastructure as Code (✅ exists)
pf k8s <subcommand>         # Kubernetes operations
pf sops <subcommand>        # Secrets management
pf sso <subcommand>         # Single Sign-On (✅ exists)
pf terraform <subcommand>   # Terraform operations
pf tunnel <subcommand>      # Network tunneling
pf vault <subcommand>       # Vault operations
pf workflow <subcommand>    # CI/CD workflow operations
```

### Detailed Command Mapping

#### AWS Commands
```
pf aws profiles list                           # ✅ exists
pf aws profile-for-context <context>          # pf-get-aws-profile-for-kube-context.sh
pf aws vpc-network-test --module-path <path>   # ✅ placeholder exists
pf aws ecr wait-on-image <image>               # wait-on-image.sh
```

#### BuildKit Commands
```
pf buildkit build <dockerfile> <context> <tags...>  # pf-buildkit-build.sh
pf buildkit clear-cache                              # pf-buildkit-clear-cache.sh
pf buildkit scale down [--timeout]                  # pf-buildkit-scale-down.sh
pf buildkit scale up [--arch]                       # pf-buildkit-scale-up.sh
pf buildkit tunnel [--arch]                         # pf-buildkit-tunnel.sh
```

#### Database Commands
```
pf db tunnel [--namespace] [--type postgresql|redis|nats]  # pf-db-tunnel.sh
```

#### Docker Commands
```
pf docker credential-helper <action>  # docker-credential-panfactum.sh
```

#### Git Commands
```
pf git get-commit-hash <ref>  # pf-get-commit-hash.sh (utility)
```

#### Kubernetes Commands
```
pf k8s cluster suspend [--cluster]     # pf-eks-suspend.sh
pf k8s cluster resume [--cluster]      # pf-eks-resume.sh
pf k8s disruptions disable             # pf-voluntary-disruptions-disable.sh
pf k8s disruptions enable              # pf-voluntary-disruptions-enable.sh
pf k8s velero snapshot-gc              # pf-velero-snapshot-gc.sh
```

#### SOPS Commands
```
pf sops set-profile <directory> <profile>  # pf-sops-set-profile.sh
```

#### Terraform Commands
```
pf terraform init                                        # pf-tf-init.sh
pf terraform delete-locks [--profile] [--table] [--region]  # pf-tf-delete-locks.sh
```

#### Tunnel Commands
```
pf tunnel <service> <port> [--namespace]  # pf-tunnel.sh
```

#### Workflow Commands
```
pf workflow git-checkout <ref> <directory>  # pf-wf-git-checkout.sh
```

## Implementation Guidelines

### 1. Shared Utilities
Create TypeScript utilities for scripts that are dependencies of others:
- Place in `/src/util/<category>/`
- Export functions that can be reused across commands
- Maintain same functionality as shell scripts
- Add proper TypeScript types and error handling

### 2. CLI Commands
For scripts that become CLI commands:
- Follow existing pattern: `/src/commands/<category>/<action>/command.ts`
- Extend `PanfactumCommand`
- Use Clipanion's Option system for parameters
- Implement proper help text and examples
- Add to `/src/index.ts` registration

### 3. Error Handling
- Use `CLIError` for user-facing errors
- Maintain same exit codes as shell scripts
- Provide detailed error messages

### 4. External Dependencies
- Use existing CLI utilities for external tools (kubectl, aws, terraform, etc.)
- Wrap subprocess calls in try/catch blocks
- Validate tool availability before execution

### 5. Configuration
- Leverage existing `PanfactumContext` for shared configuration
- Use existing configuration utilities in `/src/util/config/`
- Maintain compatibility with current config file formats

## Migration Order

### Week 1-2: Foundation
1. Core utilities (getOpenPort, getModuleHash, getCommitHash)
2. Independent commands (terraform init, sops set-profile, wait-on-image)

### Week 3-4: Authentication
1. Vault utilities (getToken, getDbCreds)
2. AWS profile commands

### Week 5-6: Infrastructure
1. Terraform operations
2. Tunneling and networking

### Week 7-8: Container Management
1. BuildKit utilities
2. BuildKit commands
3. Docker integration

### Week 9-10: Advanced Operations
1. Database operations
2. Kubernetes management
3. CI/CD operations

### Week 11-12: Testing & Cleanup
1. Integration testing
2. Documentation updates
3. Remove old shell scripts
4. Update Nix configurations

## Testing Strategy

### Unit Tests
- Test each utility function independently
- Mock external dependencies (AWS, kubectl, etc.)
- Validate input/output transformations

### Integration Tests
- Test complete command workflows
- Use test environments where possible
- Validate interactions between commands

### Backward Compatibility
- Ensure CLI commands produce equivalent results to shell scripts
- Test edge cases and error conditions
- Validate configuration file compatibility

## Benefits of Migration

1. **Type Safety**: TypeScript provides compile-time error checking
2. **Better Error Handling**: Structured error handling with detailed messages
3. **Improved Testing**: Unit and integration tests for CLI functionality
4. **Consistent Interface**: Unified command structure and help system
5. **Better Maintenance**: Single codebase for all CLI functionality
6. **Enhanced Documentation**: Built-in help and examples for all commands