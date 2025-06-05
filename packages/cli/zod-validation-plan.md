# Zod Validation Plan

This document identifies locations in the CLI codebase where Zod schema validation is missing for external input and output.

## High Priority (Security Critical)

### 1. Vault Operations
**File**: `src/util/vault/getDbCreds.ts:35-39`
- **Issue**: Direct JSON.parse of vault command output without validation
- **Risk**: Database credentials could be malformed, causing silent failures
- **Command**: `vault kv get -format=json database/creds/${role}`
- **Fix**: Create VaultDbCredsSchema

**File**: `src/util/vault/getVaultToken.ts:19-23`
- **Issue**: Direct JSON.parse of vault token metadata
- **Risk**: Authentication tokens could be invalid
- **Command**: `vault auth -format=json`
- **Fix**: Create VaultTokenSchema

### 2. AWS Authentication
**File**: `src/util/aws/getIdentity.ts:28-32`
- **Issue**: Direct JSON.parse of AWS STS identity without validation
- **Risk**: AWS identity validation failures
- **Command**: `aws sts get-caller-identity --output json`
- **Fix**: Create AWSIdentitySchema

**File**: `src/util/docker/getEcrToken.ts:25-29`
- **Issue**: Direct JSON.parse of ECR authorization token
- **Risk**: Docker registry authentication failures
- **Command**: `aws ecr get-authorization-token --output json`
- **Fix**: Create ECRTokenSchema

## Medium Priority (Infrastructure Operations)

### 3. Kubernetes Operations
**File**: `src/commands/k8s/get-token/command.ts:45-49`
- **Issue**: Direct JSON.parse of EKS token without validation
- **Risk**: Kubernetes authentication failures
- **Command**: `aws eks get-token --cluster-name ${cluster} --output json`
- **Fix**: Create EKSTokenSchema

**File**: `src/util/devshell/updateKubeConfig.ts:67-71`
- **Issue**: kubectl command output parsed without validation
- **Risk**: Invalid kubeconfig updates
- **Command**: `kubectl config current-context`
- **Fix**: Create KubectlContextSchema

**File**: `src/util/devshell/tasks/syncKubeClustersTask.ts:89-93`
- **Issue**: kubectl get clusters parsing without validation
- **Risk**: Cluster discovery failures
- **Command**: `kubectl config get-clusters --output json`
- **Fix**: Create KubectlClustersSchema

### 4. Terragrunt Operations
**File**: `src/util/terragrunt/getModuleStatus.ts:45-49`
- **Issue**: Direct JSON.parse of terragrunt show output
- **Risk**: Module status detection failures
- **Command**: `terragrunt show -json`
- **Fix**: Create TerragruntShowSchema

### 5. AWS Service Integrations
**File**: `src/util/aws/getSSMCommandOutput.ts:35-39`
- **Issue**: Direct JSON.parse of SSM command output
- **Risk**: Invalid command execution results
- **Command**: `aws ssm get-command-invocation --output json`
- **Fix**: Create SSMCommandOutputSchema

**File**: `src/commands/domain/add/getDomainPrice.ts:25-29`
- **Issue**: Direct JSON.parse of Route53 domain pricing
- **Risk**: Invalid pricing information
- **Command**: `aws route53domains get-domain-detail --output json`
- **Fix**: Create DomainPriceSchema

## Low Priority (Configuration & Metadata)

### 6. File System Operations
**File**: `src/util/config/getConfigValuesFromFile.ts:23-27`
- **Issue**: YAML parsing with type assertion instead of schema validation
- **Risk**: Invalid configuration values
- **Fix**: Use existing readYAMLFile utility with proper schema

**File**: `src/util/devshell/tasks/syncDomainsTask.ts:45-49`
- **Issue**: Domain configuration parsing without full validation
- **Risk**: Invalid domain setup
- **Fix**: Enhance existing domain schemas

### 7. Git Operations
**File**: `src/util/git/getCommitHash.ts:19-23`
- **Issue**: Git command output not validated (though simple string)
- **Risk**: Low - simple string output
- **Command**: `git rev-parse HEAD`
- **Fix**: Create GitCommitHashSchema (optional)

## Implementation Strategy

### Phase 1: Security Critical (High Priority)
1. Vault operations (database credentials, tokens)
2. AWS authentication (STS identity, ECR tokens)
3. EKS token operations

### Phase 2: Infrastructure Operations (Medium Priority)
1. Kubernetes cluster operations
2. Terragrunt module status
3. AWS service integrations

### Phase 3: Configuration & Metadata (Low Priority)
1. Configuration file parsing improvements
2. Git and other utility operations

## Existing Good Patterns to Follow

The codebase already has excellent validation patterns established:

- `src/util/terragrunt/terragruntOutput.ts` - Proper Zod validation for terragrunt output
- `src/util/sops/sopsDecrypt.ts` - Schema validation for SOPS operations
- `src/util/yaml/readYAMLFile.ts` - Generic YAML parsing with schema validation
- `src/util/zod/parseJson.ts` - Utility for JSON parsing with Zod schemas

## Schema Location Strategy

Create schemas in appropriate utility directories:
- Vault schemas: `src/util/vault/schemas.ts`
- AWS schemas: `src/util/aws/schemas.ts`
- Kubernetes schemas: `src/util/k8s/schemas.ts`
- Terragrunt schemas: `src/util/terragrunt/schemas.ts`

## Benefits

1. **Type Safety**: Catch malformed external data at runtime
2. **Better Error Messages**: Zod provides detailed validation errors
3. **Documentation**: Schemas serve as living documentation of expected data structures
4. **Consistency**: Standardize external data handling across the codebase
5. **Security**: Prevent processing of unexpected data structures

## Timeline

- **Week 1**: Implement Phase 1 (security critical)
- **Week 2**: Implement Phase 2 (infrastructure operations)
- **Week 3**: Implement Phase 3 (configuration & metadata)
- **Week 4**: Testing and refinement