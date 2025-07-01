// This file provides utilities for creating Vault proxy connections
// It manages kubectl port-forward processes for Vault access

import { createServer } from "net";
import { CLISubprocessError } from "@/util/error/error";
import { addBackgroundProcess } from "./killBackgroundProcess";

/**
 * Input parameters for starting a Vault proxy
 */
interface IStartVaultProxyInput {
  /** Environment variables for the kubectl process */
  env?: Record<string, string | undefined>;
  /** Kubernetes context to use */
  kubeContext: string;
  /** Module path for error reporting */
  modulePath: string;
}

/**
 * Output from starting a Vault proxy
 */
interface IStartVaultProxyOutput {
  /** Process ID of the kubectl port-forward */
  pid: number;
  /** Local port where Vault is accessible */
  port: number;
}

/**
 * Starts a kubectl port-forward proxy to access Vault
 * 
 * @remarks
 * This function creates a background kubectl port-forward process that
 * proxies connections from a local port to the Vault service in Kubernetes.
 * It automatically finds an available port starting from 8200.
 * 
 * @param input - Configuration for the Vault proxy
 * @returns Process ID and local port information
 * 
 * @example
 * ```typescript
 * const proxy = await startVaultProxy({
 *   kubeContext: 'production-cluster',
 *   modulePath: '/path/to/module',
 *   env: process.env
 * });
 * console.log(`Vault available at http://localhost:${proxy.port}`);
 * ```
 * 
 * @throws {@link CLISubprocessError}
 * Throws when the kubectl port-forward process fails to start
 * 
 * @see {@link addBackgroundProcess} - For process tracking
 */
export async function startVaultProxy(input: IStartVaultProxyInput): Promise<IStartVaultProxyOutput> {
  const { env, kubeContext, modulePath } = input;
  const openPort = await findAvailablePort(8200);
  const command = [
    "kubectl",
    "port-forward",
    "--address",
    "0.0.0.0",
    "-n",
    "vault",
    "--context",
    kubeContext,
    "svc/vault-active",
    `${openPort}:8200`,
  ];

  const proc = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
    env,
  });

  // Check if the process started successfully
  if (!proc.pid || proc.exitCode !== null) {
    throw new CLISubprocessError(
      `Failed to start Vault proxy for ${modulePath}`,
      {
        command: command.join(' '),
        subprocessLogs: 'Process failed to start',
        workingDirectory: process.cwd(),
      }
    );
  }

  addBackgroundProcess({
    pid: proc.pid,
    command: command.join(' '),
    description: `Vault proxy for ${modulePath} on port ${openPort}`
  });
  
  return { pid: proc.pid, port: openPort };
}

/**
 * Finds an available network port within a range
 * 
 * @internal
 * @param startPort - Starting port number to check
 * @param endPort - Ending port number (default: startPort + 1000)
 * @returns First available port found
 * 
 * @throws {@link CLISubprocessError}
 * Throws when no available ports are found in the range
 */
async function findAvailablePort(
  startPort: number,
  endPort: number = startPort + 1000
): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    const isAvailable = await isPortAvailable(port);
    if (isAvailable) {
      return port;
    }
  }
  throw new CLISubprocessError(
    `No available ports found between ${startPort} and ${endPort}`,
    {
      command: "findAvailablePort",
      subprocessLogs: `No available ports found between ${startPort} and ${endPort}`,
      workingDirectory: process.cwd(),
    }
  );
}

/**
 * Checks if a specific port is available for binding
 * 
 * @internal
 * @param port - Port number to check
 * @returns True if the port is available, false otherwise
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port);
  });
}
