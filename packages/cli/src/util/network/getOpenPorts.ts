// This file provides utilities for finding multiple available network ports on the local system
// It searches through port ranges to locate unused ports for services

import net from 'net';
import { CLIError } from '@/util/error/error';

/**
 * Input parameters for finding multiple open ports
 */
interface IGetOpenPortsInput {
  /** The number of ports to find */
  count: number;
  /** The port to start searching from (default: 30000) */
  startPort?: number;
  /** The maximum port to check (default: 32767) */
  endPort?: number;
}

/**
 * Finds multiple available ports on the local system within a specified range
 * 
 * @remarks
 * This function searches for multiple available ports by attempting to bind to each
 * port in sequence within the specified range. It uses the ephemeral port
 * range (30000-32767) by default, which is commonly used for temporary services.
 * 
 * @param input - Configuration for port search including count and range
 * @returns Promise resolving to an array of available port numbers
 * 
 * @example
 * ```typescript
 * // Find 3 available ports in default range
 * const ports = await getOpenPorts({ count: 3 });
 * console.log(`Using ports: ${ports.join(', ')}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to find the requested number of open ports
 * 
 * @see {@link getOpenPort} - For finding a single open port
 */
export async function getOpenPorts({ count, startPort = 30000, endPort = 32767 }: IGetOpenPortsInput): Promise<number[]> {
  const ports: number[] = [];
  let currentPort = startPort;
  
  while (ports.length < count && currentPort <= endPort) {
    const isAvailable = await checkPort(currentPort);
    if (isAvailable) {
      ports.push(currentPort);
    }
    currentPort++;
  }
  
  if (ports.length < count) {
    throw new CLIError(`Only found ${ports.length} open ports between ${startPort} and ${endPort}, but ${count} were requested`);
  }
  
  return ports;
}

/**
 * Checks if a specific port is available by attempting to bind to it
 * 
 * @internal
 * @param port - The port number to check
 * @returns Promise resolving to true if the port is available for binding
 * 
 * @remarks
 * This internal function creates a temporary TCP server and attempts to
 * bind it to the specified port. If the bind succeeds, the port is available.
 * The server is immediately closed after successful binding.
 */
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}