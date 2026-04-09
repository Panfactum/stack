// This file provides utilities for creating Vault proxy connections
// It manages kubectl port-forward processes for Vault access

import { getOpenPort } from "@/util/network/getOpenPort";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for starting a Vault proxy
 */
interface IStartVaultProxyInput {
  /** Panfactum context for logging and process management */
  context: PanfactumContext;
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
  /** Aborting this controller terminates the Vault proxy. */
  controller: AbortController;
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
 * The proxy is registered with {@link SubprocessManager} via `execute()`
 * so that Ctrl+C (SIGINT) is automatically forwarded to the proxy's process
 * group. To stop the proxy programmatically, abort the returned controller;
 * `execute()` will send SIGINT to the process group and — after
 * `autoEscalateToSigKillMs` — SIGKILL if the proxy has not yet exited.
 *
 * @param input - Configuration for the Vault proxy
 * @returns An AbortController to stop the proxy and the local port number
 *
 * @example
 * ```typescript
 * const { controller, port } = await startVaultProxy({
 *   context,
 *   kubeContext: 'production-cluster',
 *   modulePath: '/path/to/module',
 *   env: process.env
 * });
 * console.log(`Vault available at http://localhost:${port}`);
 * // When done:
 * controller.abort();
 * ```
 *
 * @throws {@link CLISubprocessError}
 * Throws when the kubectl port-forward process fails to start
 *
 * @see {@link execute} - Subprocess execution with signal management
 */
export async function startVaultProxy(input: IStartVaultProxyInput): Promise<IStartVaultProxyOutput> {
  const { context, env, kubeContext, modulePath } = input;
  const openPort = await getOpenPort({ startPort: 8200 });
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

  const controller = new AbortController();

  // execute() returns synchronously with a handle; we intentionally do NOT
  // await `handle.exited` here — the proxy runs until the caller aborts.
  // The proxy is registered with SubprocessManager so that OS-level signals
  // are forwarded automatically and so it appears in the tracked process
  // list. Aborting the controller sends SIGINT to the process group, followed
  // by SIGKILL after autoEscalateToSigKillMs if the proxy does not exit.
  context.subprocessManager.execute({
    command,
    workingDirectory: process.cwd(),
    env,
    description: `Vault proxy for ${modulePath}`,
    abortSignal: controller.signal,
    autoEscalateToSigKillMs: 5000,
    onForceKilled: () => {
      context.logger.warn(
        `Vault proxy for ${modulePath} was force-killed after failing to exit gracefully`
      );
    },
  });

  return { controller, port: openPort };
}
