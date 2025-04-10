import { createServer } from "net";
import { CLIError, CLISubprocessError } from "@/util/error/error";
import { BACKGROUND_PROCESS_PIDS } from "./backgroundProcess";

export async function startVaultProxy({
  env,
  modulePath,
}: {
  env?: Record<string, string | undefined>;
  modulePath: string;
}) {
  try {
    const openPort = await findAvailablePort(8200);
    const command = [
      "kubectl",
      "-n",
      "vault",
      "port-forward",
      "--address",
      "0.0.0.0",
      "svc/vault-active",
      `${openPort}:8200`,
    ];

    const proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
      env,
    });

    BACKGROUND_PROCESS_PIDS.push(proc.pid);
    return proc.pid;
  } catch (error) {
    throw new CLIError(`Failed to start Vault proxy for ${modulePath}`);
  }
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
