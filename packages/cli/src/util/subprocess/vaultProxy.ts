import { createServer } from "net";
import { CLISubprocessError } from "@/util/error/error";
import { addBackgroundProcess } from "./killBackgroundProcess";

export async function startVaultProxy({
  env,
  kubeContext,
  modulePath,
}: {
  env?: Record<string, string | undefined>;
  kubeContext: string;
  modulePath: string;
}) {
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
