// This file defines the Panfactum context object that is passed to all CLI commands
// It extends Clipanion's base context with Panfactum-specific functionality

import { phClient } from "@/util/posthog/tracking";
import { getRepoVariables } from "./getRepoVariables";
import { Logger } from "./logger";
import type { BaseContext } from "clipanion";

/**
 * Panfactum-specific context object passed to all CLI commands
 * 
 * @remarks
 * This context extends Clipanion's BaseContext with additional properties
 * needed throughout the Panfactum CLI:
 * - Repository configuration variables
 * - Custom logger instance for formatted output
 * - Analytics tracking client
 * 
 * The context is created once at CLI startup and passed to every command,
 * providing a consistent interface for accessing common functionality.
 */
export type PanfactumContext = BaseContext & {
  /** Repository configuration variables loaded from the filesystem */
  repoVariables: Awaited<ReturnType<typeof getRepoVariables>>;
  /** Logger instance for formatted console output */
  logger: Logger;
  /** PostHog analytics client for usage tracking */
  track: typeof phClient;
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
 * 1. Loading repository variables from the filesystem
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
 * @see {@link getRepoVariables} - For repository configuration loading
 * @see {@link Logger} - For logging functionality
 */
export const createPanfactumContext = async (
  context: BaseContext,
  opts: ICreatePanfactumContextOptions
): Promise<PanfactumContext> => {
  const repoVariables = await getRepoVariables(opts.cwd);

  return {
    ...context,
    repoVariables,
    logger: new Logger(context.stderr, opts.debugEnabled),
    track: phClient
  };
};
