// This file provides utilities for finding available network ports on the local system
// It searches through port ranges to locate unused ports for services

import { CLIError } from '@/util/error/error';
import { isPortAvailable } from '@/util/network/isPortAvailable';

/**
 * Input parameters for finding an open port
 */
interface IGetOpenPortInput {
  /** The port to start searching from (default: 30000) */
  startPort?: number;
  /** The maximum port to check (default: 32767) */
  endPort?: number;
}

/**
 * Finds an available port on the local system within a specified range
 * 
 * @remarks
 * This function searches for an available port by attempting to bind to each
 * port in sequence within the specified range. It uses the ephemeral port
 * range (30000-32767) by default, which is commonly used for temporary services.
 * 
 * Key features:
 * - **Sequential Search**: Tests ports in order from start to end
 * - **Bind Testing**: Actually attempts to bind to ensure port is truly available
 * - **Configurable Range**: Allows custom port ranges for specific needs
 * - **Error Handling**: Throws descriptive errors when no ports are found
 * 
 * The function works by creating a temporary server on each port and checking
 * if it can successfully bind. This ensures the port is not only unbound but
 * also available for use by the current process.
 * 
 * Common use cases:
 * - Finding ports for development servers
 * - Allocating ports for tunnel endpoints
 * - Setting up temporary services
 * - Port forwarding configurations
 * - Load balancer backend ports
 * 
 * @param input - Configuration for port search
 * @returns Available port number within the specified range
 * 
 * @example
 * ```typescript
 * // Find any available port in default range
 * const port = await getOpenPort({});
 * console.log(`Using port ${port}`);
 * ```
 * 
 * @example
 * ```typescript
 * // Find port in custom range
 * const webPort = await getOpenPort({
 *   startPort: 8000,
 *   endPort: 8999
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Using function overload with positional parameters
 * const devPort = await getOpenPort(3000, 3100);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when no available ports are found in the specified range
 * 
 * @see {@link isPortAvailable} - Port availability checker
 */
export async function getOpenPort({ startPort = 30000, endPort = 32767 }: IGetOpenPortInput = {}): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    const isAvailable = await isPortAvailable(port);
    if (isAvailable) {
      return port;
    }
  }

  throw new CLIError(`No open ports found between ${startPort} and ${endPort}`);
}

