import net from 'net';
import { CLIError } from '@/util/error/error';

/**
 * Finds multiple available ports on the system
 * @param count - The number of ports to find
 * @param startPort - The port to start searching from (default: 30000)
 * @param endPort - The maximum port to check (default: 32767)
 * @returns Promise resolving to an array of available port numbers
 */
export async function getOpenPorts(count: number, startPort = 30000, endPort = 32767): Promise<number[]> {
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
 * Checks if a specific port is available
 * @param port - The port number to check
 * @returns Promise resolving to true if the port is available
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