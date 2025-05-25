# Migration Summary

## Completed Migrations

### Phase 2: Authentication & Secrets

#### 2.1 Shared Authentication Services
- ✅ `pf-get-vault-token.sh` → `src/util/vault/getToken.ts`
  - Handles Vault OIDC authentication
  - Token TTL checking and refresh
  - Silent mode support
  - Terragrunt integration

- ✅ `pf-get-db-creds.sh` → `src/util/vault/getDbCreds.ts`
  - Retrieves database credentials from Vault
  - Structured response parsing
  - Formatted output support

#### 2.2 CLI Commands
- ✅ `pf-get-aws-profile-for-kube-context.sh` → `pf aws profile-for-context <context>`
  - Maps Kubernetes contexts to AWS profiles
  - Reads from kube/config.user.yaml
  - Validates context existence

## Usage Examples

### Vault Utilities (for internal use)
```typescript
// Get Vault token
import { getVaultTokenString } from './util/vault';
const token = await getVaultTokenString({ address: 'https://vault.example.com' });

// Get database credentials
import { getDbCreds } from './util/vault';
const creds = await getDbCreds({ role: 'my-app', vaultAddress: 'https://vault.example.com' });
```

### CLI Commands
```bash
# Get AWS profile for a Kubernetes context
pf aws profile-for-context production-primary

# Returns: production-admin (or appropriate profile name)
```

## Files Created
- `/src/util/vault/getToken.ts` - Vault token retrieval utility
- `/src/util/vault/getDbCreds.ts` - Database credential retrieval utility
- `/src/util/vault/index.ts` - Vault utilities exports
- `/src/util/vault/README.md` - Vault utilities documentation
- `/src/commands/aws/profile-for-context/command.ts` - AWS profile lookup command

### Phase 3: Infrastructure Management

#### 3.1 Terraform/Infrastructure Commands
- ✅ `pf-tf-delete-locks.sh` → `pf terraform delete-locks`
  - Releases stuck Terraform state locks from DynamoDB
  - Supports filtering by user, AWS profile, table, and region
  - Maintains same functionality as shell script

#### 3.2 Network & Tunneling Commands
- ✅ `pf-tunnel.sh` → `pf tunnel <bastion> <remote-address>`
  - Establishes SSH tunnels through bastion hosts
  - Interactive port selection when not specified
  - Automatic SSH key generation and Vault signing
  - Uses autossh for persistent connections

### Phase 4: Container & Build Management

#### 4.1 Shared BuildKit Utilities
Created reusable utilities for BuildKit operations:
- ✅ `pf-buildkit-validate.sh` → `src/util/buildkit/constants.ts`
  - Defines shared constants and types
  - Architecture type: 'amd64' | 'arm64'
- ✅ `pf-buildkit-get-address.sh` → `src/util/buildkit/getAddress.ts`
  - Finds BuildKit instance with least CPU usage
  - Returns cluster-internal TCP address
- ✅ `pf-buildkit-record-build.sh` → `src/util/buildkit/recordBuild.ts`
  - Records build timestamp on StatefulSet annotations
  - Prevents premature scale-down during builds
- ✅ Additional utilities:
  - `src/util/buildkit/config.ts` - BuildKit configuration management
  - `src/util/buildkit/getLastBuildTime.ts` - Retrieves last build timestamp

#### 4.2 BuildKit CLI Commands
- ✅ `pf-buildkit-scale-up.sh` → `pf buildkit scale up`
  - Scales BuildKit from 0 to 1 replica
  - Options: `--only=<arch>`, `--wait`, `--context`
  - Records "build" to prevent immediate scale-down
- ✅ `pf-buildkit-scale-down.sh` → `pf buildkit scale down`
  - Scales BuildKit to 0 replicas
  - Options: `--timeout=<seconds>`, `--context`
  - Respects timeout based on last build annotation
- ✅ `pf-buildkit-clear-cache.sh` → `pf buildkit clear-cache`
  - Deletes unused PVCs
  - Prunes cache in running BuildKit pods
  - Options: `--context`
- ✅ `pf-buildkit-tunnel.sh` → `pf buildkit tunnel`
  - Creates network tunnel to BuildKit server
  - Options: `--arch=<arch>`, `--port=<port>`
  - Auto-scales BuildKit instance before connecting
- ✅ `pf-buildkit-build.sh` → `pf buildkit build`
  - Multi-platform container builds (amd64 + arm64)
  - Options: `--repo`, `--tag`, `--file`, `--context`
  - Parallel builds with automatic tunnel management
  - Creates multi-platform manifest with manifest-tool
  - Supports S3 cache import/export

## Next Steps
Continue with Phase 5 migrations as outlined in MIGRATION_PLAN.md