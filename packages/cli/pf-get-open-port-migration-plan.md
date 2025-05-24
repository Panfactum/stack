# Migration Plan: pf-get-open-port.sh

This document details the migration of `pf-get-open-port.sh` from a shell script to a TypeScript utility in the Panfactum CLI.

## Current Script Analysis

### Script Location
`packages/nix/packages/scripts/pf-get-open-port.sh`

### Script Purpose
Finds an available TCP port on localhost by:
1. Starting with a random port between 1024-10024
2. Checking up to 100 consecutive ports
3. Returning the first available port

### Dependencies
- **External Tools**: `lsof` (list open files)
- **Internal Scripts**: None (independent utility)
- **Used By**: `pf-buildkit-build.sh`, `pf-db-tunnel.sh`

### Current Behavior
```bash
# Generates random starting port (1024-10024)
START_PORT=$((RANDOM % 9001 + 1024))

# Checks ports in shuffled order for availability
for PORT in $(seq $START_PORT $((START_PORT + 100)) | shuf); do
  if ! lsof "-iTCP@127.0.0.1:$PORT" -sTCP:LISTEN -n -P >/dev/null; then
    echo "$PORT"
    break
  fi
done
```

## Migration Target

### Location
`packages/cli/src/util/network/getOpenPort.ts`

### TypeScript Implementation

```typescript
// packages/cli/src/util/network/getOpenPort.ts

import { createServer } from 'net';
import { CLIError } from '../error/error';

export interface GetOpenPortOptions {
  /**
   * Starting port to search from
   * @default Random between 1024-10024
   */
  startPort?: number;
  
  /**
   * Maximum number of ports to check
   * @default 100
   */
  maxAttempts?: number;
  
  /**
   * Host to check port availability on
   * @default '127.0.0.1'
   */
  host?: string;
}

/**
 * Finds an available TCP port on the specified host
 * 
 * This function replaces the shell script pf-get-open-port.sh
 * It uses Node.js net module instead of lsof for better cross-platform compatibility
 * 
 * @param options Configuration options for port search
 * @returns Promise<number> The first available port found
 * @throws CLIError if no available port is found within maxAttempts
 */
export async function getOpenPort(options: GetOpenPortOptions = {}): Promise<number> {
  const {
    startPort = Math.floor(Math.random() * 9001) + 1024,
    maxAttempts = 100,
    host = '127.0.0.1'
  } = options;

  // Create array of ports to check in random order
  const ports = Array.from(
    { length: maxAttempts }, 
    (_, i) => startPort + i
  ).sort(() => Math.random() - 0.5);

  for (const port of ports) {
    if (await isPortAvailable(host, port)) {
      return port;
    }
  }

  throw new CLIError(
    `Unable to find an available port between ${startPort} and ${startPort + maxAttempts - 1}`,
    {
      details: `Searched ${maxAttempts} ports starting from ${startPort} on host ${host}`
    }
  );
}

/**
 * Checks if a specific port is available
 * @param host The host to check
 * @param port The port to check
 * @returns Promise<boolean> True if port is available, false otherwise
 */
async function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        // Treat other errors as port being unavailable
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.listen(port, host);
  });
}

/**
 * Synchronous version of getOpenPort for compatibility with existing code
 * 
 * @deprecated Use async getOpenPort() instead
 * @param options Configuration options for port search
 * @returns number The first available port found
 * @throws CLIError if no available port is found
 */
export function getOpenPortSync(options: GetOpenPortOptions = {}): number {
  const {
    startPort = Math.floor(Math.random() * 9001) + 1024,
    maxAttempts = 100,
    host = '127.0.0.1'
  } = options;

  // For sync version, we'll use a different approach
  const net = require('net');
  
  const ports = Array.from(
    { length: maxAttempts }, 
    (_, i) => startPort + i
  ).sort(() => Math.random() - 0.5);

  for (const port of ports) {
    try {
      const server = net.createServer();
      server.listen(port, host);
      server.close();
      return port;
    } catch (err) {
      // Port is in use, continue to next
      continue;
    }
  }

  throw new CLIError(
    `Unable to find an available port between ${startPort} and ${startPort + maxAttempts - 1}`,
    {
      details: `Searched ${maxAttempts} ports starting from ${startPort} on host ${host}`
    }
  );
}
```

### Unit Tests

```typescript
// packages/cli/src/util/network/getOpenPort.test.ts

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createServer, Server } from 'net';
import { getOpenPort, getOpenPortSync } from './getOpenPort';

describe('getOpenPort', () => {
  let servers: Server[] = [];

  afterEach(() => {
    // Clean up any test servers
    servers.forEach(server => server.close());
    servers = [];
  });

  test('should find an available port', async () => {
    const port = await getOpenPort();
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(10024);
  });

  test('should respect custom start port', async () => {
    const startPort = 20000;
    const port = await getOpenPort({ startPort });
    expect(port).toBeGreaterThanOrEqual(startPort);
    expect(port).toBeLessThan(startPort + 100);
  });

  test('should skip occupied ports', async () => {
    // Occupy a specific port
    const occupiedPort = 30000;
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(occupiedPort, '127.0.0.1', () => resolve());
    });
    servers.push(server);

    // Request port starting from the occupied one
    const port = await getOpenPort({ startPort: occupiedPort, maxAttempts: 10 });
    expect(port).not.toBe(occupiedPort);
    expect(port).toBeGreaterThan(occupiedPort);
  });

  test('should throw error when no ports available', async () => {
    // Occupy all ports in range
    const startPort = 40000;
    const maxAttempts = 5;
    
    for (let i = 0; i < maxAttempts; i++) {
      const server = createServer();
      await new Promise<void>((resolve) => {
        server.listen(startPort + i, '127.0.0.1', () => resolve());
      });
      servers.push(server);
    }

    await expect(
      getOpenPort({ startPort, maxAttempts })
    ).rejects.toThrow('Unable to find an available port');
  });

  test('should work with custom host', async () => {
    const port = await getOpenPort({ host: '0.0.0.0' });
    expect(port).toBeGreaterThanOrEqual(1024);
  });
});

describe('getOpenPortSync', () => {
  test('should find an available port synchronously', () => {
    const port = getOpenPortSync();
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(10024);
  });
});
```

## Integration Points

### 1. Update pf-buildkit-build.sh Usage

**Current Usage:**
```bash
# In pf-buildkit-build.sh
LOCAL_PORT=$(pf-get-open-port)
```

**After Migration:**
```typescript
// In buildkit/build command
import { getOpenPort } from '@/util/network/getOpenPort';

const localPort = await getOpenPort();
```

### 2. Update pf-db-tunnel.sh Usage

**Current Usage:**
```bash
# In pf-db-tunnel.sh
LOCAL_PORT=$(pf-get-open-port)
```

**After Migration:**
```typescript
// In db/tunnel command
import { getOpenPort } from '@/util/network/getOpenPort';

const localPort = await getOpenPort();
```

## Migration Steps

### Phase 1: Implementation (Week 1)
1. Create directory structure: `src/util/network/`
2. Implement `getOpenPort.ts` with both async and sync versions
3. Write comprehensive unit tests
4. Add JSDoc documentation

### Phase 2: Testing (Week 1)
1. Run unit tests
2. Test edge cases (all ports occupied, specific ranges)
3. Performance testing (compare with shell script)
4. Cross-platform testing (macOS, Linux)

### Phase 3: Integration (Week 2)
1. Update BuildKit commands to use new utility
2. Update database tunnel commands to use new utility
3. Remove dependency on `lsof` command
4. Update any other references

### Phase 4: Validation (Week 2)
1. End-to-end testing of BuildKit builds
2. End-to-end testing of database tunnels
3. Performance comparison with original script
4. User acceptance testing

### Phase 5: Cleanup
1. Mark shell script as deprecated
2. Update documentation
3. Remove shell script after grace period


## Notes

- The TypeScript implementation uses Node.js `net` module instead of `lsof`
- This approach is more portable and doesn't require external dependencies
- The random shuffle behavior is preserved to distribute port usage
- Both async and sync versions provided for compatibility during migration