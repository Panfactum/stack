# Vault Utilities

This directory contains TypeScript utilities for interacting with HashiCorp Vault, migrated from shell scripts.

## Utilities

### getToken.ts
Retrieves a Vault authentication token, handling token refresh when needed.

**Features:**
- Supports OIDC authentication
- Token TTL checking (refreshes if < 30 minutes remaining)
- Environment variable support (VAULT_TOKEN, VAULT_ADDR)
- Silent mode for error handling
- Special handling for Terragrunt workflows

**Usage:**
```typescript
import { getVaultToken, getVaultTokenString } from './vault/getToken';

// Get token with detailed result
const result = await getVaultToken({ 
  address: 'https://vault.example.com',
  silent: true 
});

// Get just the token string (throws on error)
const token = await getVaultTokenString();
```

### getDbCreds.ts
Retrieves database credentials from Vault for a specific role.

**Features:**
- Reads credentials from `db/creds/<role>` path
- Returns structured credential data
- Supports formatted text output (similar to vault CLI)

**Usage:**
```typescript
import { getDbCreds, getDbCredsFormatted } from './vault/getDbCreds';

// Get structured credentials
const creds = await getDbCreds({ 
  role: 'my-app-role',
  vaultAddress: 'https://vault.example.com' 
});

// Get formatted output (similar to vault CLI)
const formatted = await getDbCredsFormatted({ role: 'my-app-role' });
```

## Migration Status
- ✅ `pf-get-vault-token.sh` → `getToken.ts`
- ✅ `pf-get-db-creds.sh` → `getDbCreds.ts`