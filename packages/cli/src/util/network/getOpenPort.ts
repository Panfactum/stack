import net from 'net';

/**
 * Finds an available port on the system
 * @param startPort - The port to start searching from (default: 30000)
 * @param endPort - The maximum port to check (default: 32767)
 * @returns Promise resolving to an available port number
 */
export async function getOpenPort(startPort = 30000, endPort = 32767): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    const isAvailable = await checkPort(port);
    if (isAvailable) {
      return port;
    }
  }
  
  throw new Error(`No open ports found between ${startPort} and ${endPort}`);
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