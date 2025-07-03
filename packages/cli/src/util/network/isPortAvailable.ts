// This file provides utilities for checking network port availability
// It uses Node.js net module to test if a port can be bound

import { createServer } from "net";
import { CLIError } from "@/util/error/error";

/**
 * Options for checking port availability
 */
interface IIsPortAvailableOptions {
  /** Timeout in milliseconds for the port check (default: 5000) */
  timeout?: number;
  /** Host address to bind to (default: '0.0.0.0' for all interfaces) */
  host?: string;
}

/**
 * Checks if a specific network port is available for binding
 * 
 * @remarks
 * This function attempts to create a TCP server on the specified port.
 * If the server can bind successfully, the port is available.
 * If binding fails (usually with EADDRINUSE), the port is in use.
 * 
 * The function properly cleans up by closing the server after testing,
 * ensuring the port remains available for actual use.
 * 
 * Important considerations:
 * - The function checks all interfaces (IPv4 and IPv6) by default when using '0.0.0.0'
 * - On Unix systems, binding to ports below 1024 requires elevated privileges
 * - There is an inherent race condition between checking and using a port - another
 *   process could bind to the port between when this function returns true and when
 *   you attempt to use it
 * - The function includes timeout protection to prevent indefinite hangs
 * 
 * Error handling:
 * - EADDRINUSE: Port is already in use (returns false)
 * - EACCES: Permission denied, typically for system ports < 1024 (returns false)
 * - Other errors: Treated as port unavailable (returns false)
 * 
 * @param port - Port number to check (0-65535, where 0 lets the OS assign a port)
 * @param options - Optional configuration for the check
 * @returns Promise that resolves to true if port is available, false if in use or on error
 * 
 * @example
 * ```typescript
 * // Check if port 8080 is available
 * const available = await isPortAvailable(8080);
 * if (available) {
 *   console.log('Port 8080 is free to use');
 * } else {
 *   console.log('Port 8080 is already in use');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Check with custom timeout
 * const available = await isPortAvailable(3000, { timeout: 1000 });
 * ```
 * 
 * @example
 * ```typescript
 * // Find first available port in a range
 * for (let port = 3000; port <= 3010; port++) {
 *   if (await isPortAvailable(port)) {
 *     console.log(`Found available port: ${port}`);
 *     break;
 *   }
 * }
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when port number is invalid (not an integer between 0 and 65535)
 */
export function isPortAvailable(
  port: number,
  options: IIsPortAvailableOptions = {}
): Promise<boolean> {
  // Validate port number
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new CLIError(`Invalid port number: ${port}. Must be an integer between 0 and 65535.`);
  }

  const { timeout = 5000, host = '0.0.0.0' } = options;

  return new Promise((resolve) => {
    const server = createServer();
    let isResolved = false;

    // Create timeout first so it can be referenced in cleanup
    const timeoutId = globalThis.setTimeout(() => {
      server.removeAllListeners();
      server.close(() => {
        // Timeout reached, assume port is unavailable
        safeResolve(false);
      });
      // Force close if normal close doesn't work
      globalThis.setTimeout(() => {
        if (!isResolved) {
          safeResolve(false);
        }
      }, 100);
    }, timeout);

    // Helper to ensure we only resolve once
    const safeResolve = (value: boolean) => {
      if (!isResolved) {
        isResolved = true;
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      }
    };

    server.once("error", (_err: Error & {code?: string}) => {
      // Clear timeout and remove listeners
      server.removeAllListeners();
      
      // Common error codes:
      // - EADDRINUSE: Address already in use (port is taken)
      // - EACCES: Permission denied (often for ports < 1024)
      // - EADDRNOTAVAIL: Address not available (invalid host)
      
      // For debugging, you could log specific errors:
      // if (err.code === 'EADDRINUSE') console.debug(`Port ${port} is already in use`);
      // if (err.code === 'EACCES') console.debug(`Permission denied for port ${port}`);
      
      safeResolve(false);
    });

    server.once("listening", () => {
      // Port is available - clean up
      server.removeAllListeners();
      
      // Close the server to free the port
      server.close((_err) => {
        // Whether close succeeds or fails, the port was available when we checked
        // This is an edge case but we should handle it
        safeResolve(true);
      });
      
      // Ensure we resolve even if close hangs
      globalThis.setTimeout(() => {
        safeResolve(true);
      }, 100);
    });

    // Attempt to bind to the port
    server.listen(port, host);
  });
}