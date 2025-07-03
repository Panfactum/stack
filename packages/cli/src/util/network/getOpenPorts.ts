// This file provides utilities for finding multiple available network ports on the local system
// It searches through port ranges to locate unused ports for services

import { CLIError } from '@/util/error/error';
import { getOpenPort } from '@/util/network/getOpenPort';

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
 * This function searches for multiple available ports by leveraging the getOpenPort
 * function to find each port sequentially. It ensures no duplicate ports are returned
 * by starting each subsequent search from the port after the last found port.
 * It uses the ephemeral port range (30000-32767) by default.
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
  let currentStartPort = startPort;
  
  for (let i = 0; i < count; i++) {
    try {
      const port = await getOpenPort({ 
        startPort: currentStartPort, 
        endPort 
      });
      ports.push(port);
      // Start searching from the next port to avoid duplicates
      currentStartPort = port + 1;
    } catch {
      // If we can't find enough ports, throw an error with details
      throw new CLIError(`Only found ${ports.length} open ports between ${startPort} and ${endPort}, but ${count} were requested`);
    }
  }
  
  return ports;
}

