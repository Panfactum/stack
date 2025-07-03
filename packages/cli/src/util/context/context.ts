// This file defines the Panfactum context object that is passed to all CLI commands
// It extends Clipanion's base context with Panfactum-specific functionality

import { getDevshellConfig } from "@/util/devshell/getDevshellConfig";
import { phClient } from "@/util/posthog/tracking";
import { BackgroundProcessManager } from "@/util/subprocess/BackgroundProcessManager";
import { Logger } from "./logger";
import type { BaseContext } from "clipanion";

/**
 * Panfactum-specific context object passed to all CLI commands
 * 
 * @remarks
 * This context extends Clipanion's BaseContext with additional properties
 * needed throughout the Panfactum CLI:
 * - Devshell configuration variables
 * - Custom logger instance for formatted output
 * - Analytics tracking client
 * 
 * The context is created once at CLI startup and passed to every command,
 * providing a consistent interface for accessing common functionality.
 */
export type PanfactumContext = BaseContext & {
  /** Devshell configuration variables loaded from the filesystem */
  devshellConfig: Awaited<ReturnType<typeof getDevshellConfig>>;
  /** Logger instance for formatted console output */
  logger: Logger;
  /** PostHog analytics client for usage tracking */
  track: typeof phClient;
  /** Background process manager for tracking and controlling spawned processes */
  backgroundProcessManager: BackgroundProcessManager;
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

  // Create the context first, then initialize the background process manager
  const panfactumContext = {
    ...context,
    devshellConfig,
    logger,
    track: phClient,
    backgroundProcessManager: null as unknown as BackgroundProcessManager // Temporary placeholder
  } as PanfactumContext;

  // Initialize the background process manager with the context
  panfactumContext.backgroundProcessManager = new BackgroundProcessManager(panfactumContext);

  return panfactumContext;
};
