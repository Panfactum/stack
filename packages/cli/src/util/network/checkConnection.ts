// This file provides utilities for checking network connectivity to specific hosts and ports
// It performs non-blocking connection attempts with configurable timeouts

import net from "node:net";

/**
 * Input parameters for checking network connection
 */
interface ICheckConnectionInput {
    /** IP address or hostname to connect to */
    ip: string;
    /** Port number to test connection on (default: 80) */
    port?: number;
}

/**
 * Checks if a network connection can be established to a specific host and port
 * 
 * @remarks
 * This function performs a lightweight connection test to determine if a network
 * service is reachable and accepting connections. It uses a socket connection
 * attempt with a reasonable timeout to avoid hanging operations.
 * 
 * Key features:
 * - **Non-blocking**: Uses Promise-based async approach
 * - **Timeout Protection**: 3-second timeout prevents hanging
 * - **Error Handling**: Gracefully handles connection failures
 * - **Resource Cleanup**: Properly closes sockets after testing
 * 
 * The function attempts to establish a TCP connection to the specified host
 * and port. It returns true if the connection succeeds (indicating the service
 * is available) or false if the connection fails, times out, or is rejected.
 * 
 * Common use cases:
 * - Checking if services are running before connecting
 * - Validating network connectivity
 * - Health checks for external dependencies
 * - Port scanning for available services
 * - Pre-flight checks before deployments
 * 
 * @param input - Configuration for connection test
 * @returns True if connection succeeds, false otherwise
 * 
 * @example
 * ```typescript
 * // Check if a web server is running
 * const isWebServerUp = await checkConnection({
 *   ip: 'example.com',
 *   port: 80
 * });
 * 
 * if (isWebServerUp) {
 *   console.log('Web server is accessible');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Check database connectivity
 * const isDbReachable = await checkConnection({
 *   ip: '10.0.1.100',
 *   port: 5432
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Using default port 80
 * const canReachHost = await checkConnection({
 *   ip: 'google.com'
 * });
 * ```
 * 
 * @see {@link net} - Node.js networking module used internally
 */

export function checkConnection({ ip, port = 80 }: ICheckConnectionInput): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.createConnection({
            host: ip,
            port,
            timeout: 3000 // 3 second timeout
        });

        socket.on('connect', () => {
            socket.end();
            resolve(true); // Connection successful
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false); // Connection timed out
        });

        socket.on('error', () => {
            resolve(false); // Connection rejected/blocked
        });
    });
}