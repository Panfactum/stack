# BuildKit Scripts Migration Plan

## Overview
This document outlines the migration plan for converting BuildKit bash scripts to TypeScript CLI commands.

## Script Analysis

### 1. pf-buildkit-validate.sh
**Purpose**: Sets common BuildKit variables and validates environment
**Type**: Shared utility
**Variables**:
- `BUILDKIT_STATEFULSET_NAME_PREFIX`: "buildkit-"
- `BUILDKIT_LAST_BUILD_ANNOTATION_KEY`: "panfactum.com/last-build"
- `BUILDKIT_NAMESPACE`: "buildkit"

### 2. pf-buildkit-get-address.sh
**Purpose**: Returns internal cluster TCP address of BuildKit instance with least CPU usage
**Type**: Shared utility
**Dependencies**: 
- pf-buildkit-validate
- kubectl
**Key Logic**:
- Finds running pods in buildkit namespace
- Filters by architecture (amd64/arm64)
- Sorts by CPU usage from metrics.k8s.io
- Returns address in format: `tcp://IP.buildkit.pod.cluster.local:1234`

### 3. pf-buildkit-record-build.sh
**Purpose**: Records build timestamp on StatefulSet annotation to defer scale-down
**Type**: Shared utility
**Dependencies**: 
- pf-buildkit-validate
- kubectl
**Key Logic**:
- Annotates StatefulSet with current timestamp
- Used to prevent autoscaler from scaling down during active builds

### 4. pf-buildkit-build.sh
**Purpose**: Multi-platform container build submission to BuildKit
**Type**: CLI command
**Dependencies**:
- pf-buildkit-validate
- pf-get-repo-variables
- pf-buildkit-tunnel
- pf-get-open-port
- buildctl
- manifest-tool
**Key Logic**:
- Reads buildkit.json configuration
- Creates tunnels to both amd64 and arm64 BuildKit instances
- Runs parallel builds using buildctl
- Creates multi-platform manifest

### 5. pf-buildkit-clear-cache.sh
**Purpose**: Deletes idle cache from BuildKit instances
**Type**: CLI command
**Dependencies**:
- pf-buildkit-validate
- kubectl
**Key Logic**:
- Deletes unused PVCs
- Executes cache pruning in running pods

### 6. pf-buildkit-scale-down.sh
**Purpose**: Scales BuildKit to 0 replicas with optional timeout
**Type**: CLI command
**Dependencies**:
- pf-buildkit-validate
- kubectl
**Key Logic**:
- Checks last build annotation
- Scales down if timeout elapsed or immediately

### 7. pf-buildkit-scale-up.sh
**Purpose**: Scales BuildKit from 0 to 1 replica
**Type**: CLI command
**Dependencies**:
- pf-buildkit-validate
- pf-buildkit-record-build
- kubectl
**Key Logic**:
- Scales up specified architecture(s)
- Records "build" to prevent immediate scale-down
- Optionally waits for pods to be ready

### 8. pf-buildkit-tunnel.sh
**Purpose**: Creates network tunnel to BuildKit server
**Type**: CLI command
**Dependencies**:
- pf-buildkit-validate
- pf-get-repo-variables
- pf-buildkit-scale-up
- pf-buildkit-get-address
- pf-tunnel
**Key Logic**:
- Reads buildkit.json for cluster/bastion config
- Scales up BuildKit
- Gets address and creates tunnel

## Migration Approach

### Phase 1: Create Shared Utilities
1. Create `src/util/buildkit/constants.ts` for shared constants
2. Create `src/util/buildkit/validate.ts` for validation logic
3. Create `src/util/buildkit/getAddress.ts` for address resolution
4. Create `src/util/buildkit/recordBuild.ts` for annotation management
5. Create `src/util/buildkit/config.ts` for buildkit.json handling

### Phase 2: Create CLI Command Structure
```
src/commands/buildkit/
├── build/
│   └── command.ts
├── cache/
│   └── clear/
│       └── command.ts
├── scale/
│   ├── up/
│   │   └── command.ts
│   └── down/
│       └── command.ts
└── tunnel/
    └── command.ts
```

### Phase 3: Implementation Order
1. **Utilities first**: Implement all shared utilities
2. **scale commands**: Implement scale up/down (simpler, fewer dependencies)
3. **tunnel command**: Implement tunnel (depends on scale)
4. **cache clear**: Implement cache management
5. **build command**: Implement build (most complex, depends on tunnel)

## Key Considerations

### 1. Configuration Management
- Create schema for buildkit.json validation
- Use existing config utilities where possible

### 2. Kubernetes Integration
- Use existing kubectl wrapper utilities
- Handle context switching properly

### 3. Process Management
- Build command needs careful subprocess management
- Parallel builds with proper cleanup
- Signal handling for graceful shutdown

### 4. Error Handling
- Network timeouts
- Pod readiness checks
- Build failures

### 5. Testing Strategy
- Unit tests for utilities
- Integration tests with mock kubectl
- E2E tests require actual cluster

## Dependencies to Add
- `manifest-tool` binary requirement
- `buildctl` binary requirement
- Consider adding these to Nix shell

## Migration Steps

### Step 1: Create BuildKit utilities directory
```bash
mkdir -p src/util/buildkit
```

### Step 2: Implement constants and types
- Define TypeScript interfaces for buildkit.json
- Export constants from validate.sh

### Step 3: Implement shared utilities
- Port validation logic
- Port getAddress with proper error handling
- Port recordBuild functionality

### Step 4: Create command structure
- Follow existing CLI patterns
- Use Listr2 for multi-step operations

### Step 5: Implement commands incrementally
- Start with simpler commands (scale)
- Build up to complex build command

### Step 6: Testing
- Unit tests for each utility
- Command tests with mocked dependencies