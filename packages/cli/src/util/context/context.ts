// This file defines the Panfactum context object that is passed to all CLI commands
// It extends Clipanion's base context with Panfactum-specific functionality

import { getDevshellConfig } from "@/util/devshell/getDevshellConfig";
import { phClient } from "@/util/posthog/tracking";
import { SubprocessManager } from "@/util/subprocess/SubprocessManager";
import { Logger } from "./logger";
import type { BaseContext } from "clipanion";

/**
 * Async cleanup hook that runs before the CLI process exits
 *
 * @remarks
 * Hooks are awaited (via {@link Promise.allSettled}) by the top-level
 * cleanup routine in `index.ts` before the process exits, regardless of
 * whether the exit is triggered by SIGINT, SIGTERM, normal completion,
 * or an unhandled error. Use them to release external resources that the
 * CLI cannot leak between invocations (e.g., a leaked terraform state
 * lock after a force-killed apply).
 */
export type ShutdownHook = () => Promise<void>;

/**
 * Lightweight base context shared by all CLI commands
 *
 * @remarks
 * This context provides the minimal set of properties every command needs:
 * logging, analytics tracking, and background process management. Commands
 * that don't require devshell configuration (e.g., workflow commands that
 * run before a git repo exists) use this context directly.
 *
 * @see {@link PanfactumContext} - Full context with devshell configuration
 */
export type PanfactumBaseContext = BaseContext & {
  /** Logger instance for formatted console output */
  logger: Logger;
  /** PostHog analytics client for usage tracking */
  track: typeof phClient;
  /**
   * Unified subprocess manager. Owns the singleton SIGINT/SIGTERM/SIGHUP/SIGQUIT
   * listeners, dispatches signals to every live registration, and tracks
   * background processes for observability.
   */
  subprocessManager: SubprocessManager;
  /**
   * Registers an async cleanup hook that will be awaited before the CLI
   * process exits.
   *
   * @remarks
   * Use this when a piece of code holds external state that must be
   * released even if the user interrupts the CLI (e.g., releasing a
   * leaked terraform state lock after a force-killed `terragrunt apply`).
   * The returned function unregisters the hook — callers MUST invoke it
   * once the protected operation completes successfully so the hook does
   * not run unnecessarily on a later, unrelated shutdown.
   *
   * Hooks are awaited via {@link Promise.allSettled}, so a hook that
   * rejects will not prevent other hooks from running.
   *
   * @param hook - Async function to run during shutdown
   * @returns Function that unregisters the hook
   */
  registerShutdownHook: (hook: ShutdownHook) => () => void;
  /**
   * Internal set of registered shutdown hooks. Consumers should use
   * {@link PanfactumBaseContext.registerShutdownHook} instead of
   * mutating this set directly. Exposed so the top-level cleanup
   * routine in `index.ts` can iterate it.
   *
   * @internal
   */
  shutdownHooks: Set<ShutdownHook>;
};

/**
 * Panfactum-specific context object passed to all CLI commands
 *
 * @remarks
 * This context extends PanfactumBaseContext with devshell configuration
 * loaded from the filesystem. Most commands use this context, but commands
 * that run outside a git repository (e.g., workflow commands) may use the
 * lighter {@link PanfactumBaseContext} instead.
 *
 * The context is created once at CLI startup and passed to every command,
 * providing a consistent interface for accessing common functionality.
 *
 * @see {@link PanfactumBaseContext} - Base context without devshell config
 */
export type PanfactumContext = PanfactumBaseContext & {
  /** Devshell configuration variables loaded from the filesystem */
  devshellConfig: Awaited<ReturnType<typeof getDevshellConfig>>;
};

/**
 * Options for creating a Panfactum context
 */
interface ICreatePanfactumContextOptions {
  /** Whether debug mode is enabled */
  debugEnabled: boolean;
  /** Current working directory */
  cwd: string;
}

/**
 * Creates a Panfactum context object with all required properties
 * 
 * @remarks
 * This function initializes the Panfactum context by:
 * 1. Loading devshell configuration from the filesystem
 * 2. Creating a logger instance with the appropriate debug level
 * 3. Attaching the analytics tracking client
 * 
 * The context is created once during CLI initialization and passed
 * to all commands through Clipanion's command execution pipeline.
 * 
 * @param context - Base Clipanion context to extend
 * @param opts - Configuration options for context creation
 * @returns Complete Panfactum context ready for command execution
 * 
 * @example
 * ```typescript
 * const pfContext = await createPanfactumContext(baseContext, {
 *   debugEnabled: true,
 *   cwd: process.cwd()
 * });
 * ```
 * 
 * @see {@link PanfactumContext} - The context type definition
 * @see {@link getDevshellConfig} - For devshell configuration loading
 * @see {@link Logger} - For logging functionality
 */
export const createPanfactumContext = async (
  context: BaseContext,
  opts: ICreatePanfactumContextOptions
): Promise<PanfactumContext> => {
  const devshellConfig = await getDevshellConfig(opts.cwd);
  const logger = new Logger(context.stderr, opts.debugEnabled);

  const shutdownHooks = new Set<ShutdownHook>();

  // Create the context first, then initialize the manager that depends on it
  const panfactumContext = {
    ...context,
    devshellConfig,
    logger,
    track: phClient,
    subprocessManager: null as unknown as SubprocessManager, // Temporary placeholder
    shutdownHooks,
    registerShutdownHook: (hook: ShutdownHook) => {
      shutdownHooks.add(hook);
      return () => {
        shutdownHooks.delete(hook);
      };
    },
  } as PanfactumContext;

  // Initialize the unified subprocess manager with the context
  panfactumContext.subprocessManager = new SubprocessManager(panfactumContext);

  return panfactumContext;
};

/**
 * Creates a lightweight Panfactum context without devshell configuration
 *
 * @remarks
 * This factory skips the devshell config loading step, which requires a git
 * repository to exist. It is used by commands that run before a repository
 * is available (e.g., workflow checkout commands in CI/CD containers).
 *
 * @param context - Base Clipanion context to extend
 * @param opts - Configuration options for context creation
 * @returns Lightweight Panfactum context without devshell config
 *
 * @example
 * ```typescript
 * const lightContext = createPanfactumLightContext(baseContext, {
 *   debugEnabled: false,
 *   cwd: process.cwd()
 * });
 * ```
 *
 * @see {@link PanfactumBaseContext} - The lightweight context type
 * @see {@link createPanfactumContext} - Full context factory with devshell config
 */
export const createPanfactumLightContext = (
  context: BaseContext,
  opts: ICreatePanfactumContextOptions
): PanfactumBaseContext => {
  const logger = new Logger(context.stderr, opts.debugEnabled);

  const shutdownHooks = new Set<ShutdownHook>();

  const baseContext = {
    ...context,
    logger,
    track: phClient,
    subprocessManager: null as unknown as SubprocessManager, // Temporary placeholder
    shutdownHooks,
    registerShutdownHook: (hook: ShutdownHook) => {
      shutdownHooks.add(hook);
      return () => {
        shutdownHooks.delete(hook);
      };
    },
  } as PanfactumBaseContext;

  // Initialize the unified subprocess manager with the context
  baseContext.subprocessManager = new SubprocessManager(baseContext);

  return baseContext;
};
