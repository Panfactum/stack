// This file provides utilities for running Listr2 task sequences with error handling
// It standardizes task execution and provides consistent output formatting

import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";
import type { Listr } from "listr2";

/**
 * Input parameters for running Listr tasks
 */
interface IRunTasksInput<T> {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Listr task list to execute */
  tasks: Listr<T>;
  /** Error message to display if task execution fails */
  errorMessage: string;
}

/**
 * Executes a Listr2 task sequence with standardized error handling and output formatting
 * 
 * @remarks
 * This function provides a consistent way to run Listr2 task sequences throughout
 * the CLI with proper error handling and output formatting. It:
 * 
 * - **Standardizes Execution**: Ensures all task lists run consistently
 * - **Error Handling**: Wraps exceptions in CLIError with custom messages
 * - **Output Formatting**: Adds proper spacing after task completion
 * - **Type Safety**: Preserves generic types from the task context
 * 
 * Key features:
 * - Automatic newline insertion after task completion for visual spacing
 * - Custom error messages for different failure scenarios
 * - Generic type support for task context data
 * - Integration with Panfactum logging system
 * 
 * Common use cases:
 * - Running deployment sequences
 * - Executing validation steps
 * - Performing setup operations
 * - Managing cleanup tasks
 * 
 * The function preserves the return value from the task sequence, allowing
 * downstream code to access any data produced by the tasks.
 * 
 * @param input - Configuration for task execution
 * @returns Result from the completed task sequence
 * 
 * @example
 * ```typescript
 * const deployTasks = new Listr([
 *   { title: 'Validate config', task: () => validateConfig() },
 *   { title: 'Deploy resources', task: () => deployResources() }
 * ]);
 * 
 * const result = await runTasks({
 *   context,
 *   tasks: deployTasks,
 *   errorMessage: 'Failed to deploy application'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // With typed task context
 * interface DeployContext {
 *   validated: boolean;
 *   deployed: boolean;
 * }
 * 
 * const typedTasks = new Listr<DeployContext>([...]);
 * const result = await runTasks({
 *   context,
 *   tasks: typedTasks,
 *   errorMessage: 'Deployment failed'
 * });
 * // result is typed as DeployContext
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when task execution fails, wrapping the original error with the provided message
 * 
 * @see {@link Listr} - The Listr2 task runner library
 * @see {@link PanfactumContext} - For logging and configuration context
 */
export async function runTasks<T>(input: IRunTasksInput<T>): Promise<T> {
    const { context, tasks, errorMessage } = input;
    try {
        return tasks.run().then((res) => {
            context.logger.write("") // Need a newline after tasks for spacing
            return res
        })
    } catch (e) {
        throw new CLIError(errorMessage, e)
    }
}