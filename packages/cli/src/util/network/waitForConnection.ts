// This file provides utilities for waiting until network connections become available
// It polls connections with configurable retry logic and timeouts

import { CLIError } from '@/util/error/error';
import { sleep } from '@/util/util/sleep';
import { checkConnection } from './checkConnection';

/**
 * Input parameters for waiting for network connection availability
 */
interface IWaitForConnectionInput {
  /** IP address or hostname to connect to */
  ip: string;
  /** Port number to wait for (default: 80) */
  port?: number;
  /** Maximum number of connection attempts (default: 30) */
  maxAttempts?: number;
  /** Delay between retry attempts in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Waits for a network connection to become available with configurable retry logic
 * 
 * @remarks
 * This function continuously polls a network endpoint until it becomes available
 * or the maximum number of attempts is reached. It uses the {@link checkConnection}
 * function internally to perform lightweight connection tests.
 * 
 * Key features:
 * - **Configurable Retry Logic**: Customizable attempts and delays
 * - **Non-blocking**: Uses Promise-based async approach
 * - **Timeout Protection**: Fails after max attempts to prevent infinite waiting
 * - **Error Handling**: Throws meaningful errors when connection never becomes available
 * 
 * The function is particularly useful for:
 * - Waiting for services to start up during deployments
 * - Health checking before proceeding with dependent operations
 * - Integration testing with external services
 * - CI/CD pipeline orchestration
 * - Container startup synchronization
 * 
 * @param input - Configuration for connection waiting
 * @returns Promise that resolves when connection is available
 * 
 * @example
 * ```typescript
 * // Wait for a web service to become available
 * await waitForConnection({
 *   ip: 'api.example.com',
 *   port: 443,
 *   maxAttempts: 60,
 *   retryDelay: 2000
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Wait for database with default settings
 * await waitForConnection({
 *   ip: 'localhost',
 *   port: 5432
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Wait for service with custom retry logic
 * await waitForConnection({
 *   ip: '10.0.1.100',
 *   port: 8080,
 *   maxAttempts: 120, // 2 minutes with 1s delay
 *   retryDelay: 1000
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when the connection does not become available within the specified attempts
 * 
 * @see {@link checkConnection} - Used internally for connection testing
 */
export async function waitForConnection({
  ip,
  port = 80,
  maxAttempts = 30,
  retryDelay = 1000
}: IWaitForConnectionInput): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const isConnected = await checkConnection({ ip, port });

    if (isConnected) {
      return;
    }

    // Don't sleep after the last attempt
    if (i < maxAttempts - 1) {
      await sleep(retryDelay);
    }
  }

  throw new CLIError(`Connection to ${ip}:${port} did not become available after ${maxAttempts} attempts`);
}