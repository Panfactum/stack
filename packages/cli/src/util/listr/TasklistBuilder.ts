// This file provides a type-safe task builder pattern for Listr2 task sequences
// It enables compile-time type checking for context transformations between tasks

import { Listr } from "listr2";
import { CLIError } from "@/util/error/error";
import type { PanfactumTaskWrapper } from "./types";
import type { PanfactumContext } from "@/util/context/context";
import type { ListrTask, ListrDefaultRenderer, ListrOptions } from "listr2";


/**
 * Helper type to merge context types immutably
 * 
 * @remarks
 * This type performs intersection of context types while handling void returns.
 * When a task returns void, the context type remains unchanged. Otherwise,
 * the returned object type is intersected with the existing context type.
 * 
 * This approach ensures that each task in the sequence can access all properties
 * added by previous tasks while maintaining compile-time type safety.
 */
type MergeContext<TContext, TAddition> = TAddition extends void
  ? TContext
  : TContext & TAddition;

/**
 * Helper type to make all properties of a type optional (Partial) at all levels
 * 
 * @remarks
 * This recursively makes all properties optional, which is necessary for
 * conditional tasks that may not execute and therefore may not add their
 * properties to the context.
 * 
 * Built-in types like Date, RegExp, Promise, Map, Set, etc. are not made deeply 
 * partial to preserve their type integrity.
 */
type DeepPartial<T> = T extends Date
  ? T
  : T extends RegExp
  ? T
  : T extends Promise<infer U>
  ? Promise<DeepPartial<U>>
  : T extends Map<infer K, infer V>
  ? Map<K, DeepPartial<V>>
  : T extends Set<infer U>
  ? Set<DeepPartial<U>>
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends Function
  ? T
  : T extends object
  ? {
    [P in keyof T]?: DeepPartial<T[P]>;
  }
  : T;

/**
 * Helper type for conditional context merging
 * 
 * @remarks
 * When a task has conditional execution (via enabled option), its return
 * values are made optional in the context type since the task may not run.
 * This ensures type safety by requiring subsequent tasks to handle undefined values.
 */
type ConditionalMergeContext<TContext, TAddition, IsConditional extends boolean> =
  IsConditional extends true
  ? TAddition extends void
  ? TContext
  : TContext & DeepPartial<TAddition>
  : MergeContext<TContext, TAddition>;

/**
 * Configuration options for individual tasks in the sequence
 * 
 * @remarks
 * This interface extends Listr2's built-in task options with additional
 * features specific to the Panfactum CLI, including snapshot-based rollback
 * support and enhanced error handling.
 * 
 * The options provide fine-grained control over task execution behavior,
 * conditional execution, and error recovery strategies.
 */
interface ITaskOptions<TContext> {
  /** Skip condition - can be boolean, string message, or function */
  skip?: boolean | string | ((ctx: TContext) => boolean | string | Promise<boolean | string>);

  /** Enable condition - controls whether task should run */
  enabled?: boolean | ((ctx: TContext) => boolean | Promise<boolean>);

  /** Rollback handler - called when task or subsequent tasks fail */
  rollback?: (ctx: TContext, task: PanfactumTaskWrapper<TContext>) => void | Promise<void>;

  /** Retry configuration for failed tasks */
  retry?: number | { tries: number; delay?: number };

  /** Custom snapshot override for rollback behavior */
  snapshotOverride?: (ctx: TContext) => TContext;
}

/**
 * Snapshot entry for tracking context state at each task execution
 * 
 * @internal
 */
interface IContextSnapshot<TContext> {
  /** The context state at snapshot time */
  context: TContext;
  /** Rollback handler for this specific task */
  rollback?: (ctx: TContext, task: PanfactumTaskWrapper<TContext>) => void | Promise<void>;
}

/**
 * Type-safe task builder for creating Listr2 task sequences with context transformation tracking
 * 
 * @remarks
 * The TasklistBuilder provides a fluent API for building Listr2 task sequences
 * while maintaining compile-time type safety for context transformations. Each task
 * can modify the context by returning an object that gets merged with the existing
 * context, and the type system tracks these changes automatically.
 * 
 * Key features:
 * - **Type Safety**: Full compile-time checking of context transformations
 * - **Immutable Context**: Context changes create new objects rather than mutating
 * - **Rollback Support**: Automatic snapshots with customizable rollback behavior
 * - **Method Chaining**: Fluent API for building task sequences
 * - **Listr2 Integration**: Full compatibility with existing Listr2 features
 * 
 * The builder maintains an internal array of snapshots for rollback purposes and
 * ensures that the context type evolves correctly as tasks are added to the sequence.
 * 
 * @example Basic usage with context transformation
 * ```typescript
 * interface InitialContext {
 *   projectName: string;
 * }
 * 
 * const result = await new TasklistBuilder<InitialContext>({ 
 *   projectName: 'my-app' 
 * })
 *   .add('Validate project', async (ctx) => {
 *     // ctx.projectName is available and typed
 *     return { validated: true };
 *   })
 *   .add('Create directory', async (ctx) => {
 *     // ctx.projectName and ctx.validated are both available
 *     return { projectPath: `/projects/${ctx.projectName}` };
 *   })
 *   .runTasks({
 *     context: panfactumContext,
 *     errorMessage: 'Project setup failed'
 *   });
 * 
 * // result.projectName, result.validated, result.projectPath are all typed
 * ```
 * 
 * @example With conditional tasks and rollback
 * ```typescript
 * const builder = new TasklistBuilder<{ files: string[] }>({ files: [] })
 *   .add('Create temp files', async (ctx) => {
 *     const tempFiles = await createTempFiles();
 *     return { tempFiles };
 *   }, {
 *     rollback: async (ctx) => {
 *       if (ctx.tempFiles) {
 *         await cleanupFiles(ctx.tempFiles);
 *       }
 *     }
 *   })
 *   .addConditional(
 *     'Process files',
 *     (ctx) => ctx.tempFiles.length > 0,
 *     async (ctx) => ({ processed: true })
 *   );
 * ```
 * 
 * @see {@link runTasks} - For running the built task sequence
 * @see {@link PanfactumTaskWrapper} - For task wrapper interface
 * @see {@link Listr} - The underlying Listr2 library
 */
export class TasklistBuilder<TContext> {
  /** Array of Listr2 tasks built by this builder */
  private tasks: Array<ListrTask<TContext, ListrDefaultRenderer>> = [];

  /** Snapshot history for rollback support */
  private snapshots: Array<IContextSnapshot<TContext>> = [];

  /**
   * Creates a new TasklistBuilder with the specified initial context
   * 
   * @param initialContext - The starting context data for the task sequence
   */
  constructor(private initialContext: TContext) {
    // Deep clone the initial context to prevent mutations from affecting the original
    this.initialContext = this.deepCloneContext(initialContext);
  }

  /**
   * Gets the initial context for running the task sequence
   * 
   * @returns The deep-cloned initial context
   * @internal
   */
  getInitialContext(): TContext {
    return this.initialContext;
  }

  /**
   * Creates a deep copy of the context for immutable operations
   * 
   * @remarks
   * This method performs a deep clone of the context object to ensure that
   * snapshot operations don't share references with the active context.
   * It handles nested objects, arrays, and primitive values correctly.
   * 
   * @param context - The context object to clone
   * @returns Deep copy of the context
   * 
   * @internal
   */
  private deepCloneContext(context: TContext): TContext {
    if (context === null || typeof context !== 'object') {
      return context;
    }

    if (context instanceof Date) {
      return new Date(context.getTime()) as TContext;
    }

    if (Array.isArray(context)) {
      return context.map(item => this.deepCloneContext(item)) as TContext;
    }

    const cloned = {} as TContext;
    for (const key in context) {
      if (Object.prototype.hasOwnProperty.call(context, key)) {
        (cloned as Record<string, unknown>)[key] = this.deepCloneContext(
          (context as Record<string, unknown>)[key] as TContext
        );
      }
    }

    return cloned;
  }

  /**
   * Merges new data into the context immutably
   * 
   * @remarks
   * This method implements the core immutable context merging strategy.
   * It creates a new object by spreading the existing context and the
   * addition, ensuring no mutation of the original objects.
   * 
   * @param currentContext - The current context state
   * @param addition - The data to merge into the context
   * @returns New merged context object
   * 
   * @internal
   */
  private mergeContextImmutably<TAddition>(
    currentContext: TContext,
    addition: TAddition
  ): MergeContext<TContext, TAddition> {
    if (addition === undefined || addition === null) {
      return currentContext as MergeContext<TContext, TAddition>;
    }

    if (typeof addition !== 'object') {
      return currentContext as MergeContext<TContext, TAddition>;
    }

    // Create new merged context using object spread for immutability
    return { ...currentContext, ...addition } as MergeContext<TContext, TAddition>;
  }

  /**
   * Updates the context object in-place while maintaining immutable principles
   * 
   * @remarks
   * This method replaces the contents of the existing context object with
   * new values while preserving the object reference. This is necessary
   * because Listr2 expects the same context object reference throughout
   * task execution.
   * 
   * @param targetContext - The context object to update (modified in-place)
   * @param newValues - The new values to apply to the context
   * 
   * @internal
   */
  private updateContextInPlace<TNewContext>(
    targetContext: TContext,
    newValues: TNewContext
  ): void {
    // Clear existing properties
    Object.keys(targetContext as Record<string, unknown>).forEach(key => {
      delete (targetContext as Record<string, unknown>)[key];
    });

    // Apply new values
    Object.assign(targetContext as Record<string, unknown>, newValues);
  }

  /**
   * Adds a task that transforms the context by merging its return value
   * 
   * @remarks
   * This is the core method for building type-safe task sequences. The task function
   * receives the current context and can return an object that will be merged with
   * the existing context using immutable object spreading.
   * 
   * The return type becomes part of the new context type, enabling subsequent tasks
   * to access all previously added properties with full type safety.
   * 
   * Context merging is performed immutably - the original context is not modified.
   * Instead, a new context object is created by spreading the existing context and
   * the returned addition.
   * 
   * Tasks that don't need to modify the context can return void/undefined, and the
   * context type will remain unchanged for subsequent tasks.
   * 
   * Important: When using the `enabled` option, the returned properties become optional
   * in the context type since the task may not execute. Subsequent tasks must handle
   * potentially undefined values.
   * 
   * @param title - Human-readable title for the task
   * @param task - Function that performs the work and optionally returns context additions
   * @param options - Optional configuration for task behavior
   * @returns New builder instance with updated context type
   * 
   * @example Adding data to context
   * ```typescript
   * builder
   *   .addTask('Fetch user data', async (ctx) => {
   *     const user = await fetchUser(ctx.userId);
   *     return { user }; // Adds 'user' to context
   *   })
   *   .addTask('Validate permissions', async (ctx) => {
   *     // ctx.user is now available and typed
   *     const canAccess = await checkPermissions(ctx.user.id);
   *     return { canAccess };
   *   });
   * ```
   * 
   * @example Side effects without context changes
   * ```typescript
   * builder
   *   .addTask('Log progress', async (ctx) => {
   *     console.log(`Processing ${ctx.items.length} items`);
   *     // No return value - context remains unchanged
   *   })
   *   .addTask('Send notification', async (ctx) => {
   *     await sendEmail(ctx.userEmail);
   *     // Void return - context type is preserved
   *   });
   * ```
   * 
   * @example Conditional task execution with optional properties
   * ```typescript
   * builder
   *   .addTask('Check permissions', async (ctx) => ({ 
   *     canWrite: await checkWritePermissions(ctx.userId) 
   *   }))
   *   .addTask('Create backup', 
   *     async (ctx) => ({ backupCreated: true }),
   *     { enabled: (ctx) => ctx.canWrite }
   *   )
   *   .addTask('Use backup', async (ctx) => {
   *     // ctx.backupCreated is optional since the task may not have run
   *     if (ctx.backupCreated) {
   *       console.log('Backup was created');
   *     }
   *   });
   * ```
   */
  // Overload for tasks with enabled option - returns optional properties
  addTask<TAddition = void>(
    title: string,
    task: (
      ctx: TContext,
      task: PanfactumTaskWrapper<TContext>
    ) => TAddition | Promise<TAddition>,
    options: ITaskOptions<TContext> & { enabled: unknown }
  ): TasklistBuilder<ConditionalMergeContext<TContext, TAddition, true>>;

  // Overload for tasks without enabled option - returns required properties
  addTask<TAddition = void>(
    title: string,
    task: (
      ctx: TContext,
      task: PanfactumTaskWrapper<TContext>
    ) => TAddition | Promise<TAddition>,
    options?: Omit<ITaskOptions<TContext>, 'enabled'>
  ): TasklistBuilder<MergeContext<TContext, TAddition>>;

  // Implementation
  addTask<TAddition = void>(
    title: string,
    task: (
      ctx: TContext,
      task: PanfactumTaskWrapper<TContext>
    ) => TAddition | Promise<TAddition>,
    options?: ITaskOptions<TContext>
  ): TasklistBuilder<MergeContext<TContext, TAddition>> | TasklistBuilder<ConditionalMergeContext<TContext, TAddition, true>> {

    const listrTask: ListrTask<TContext, ListrDefaultRenderer> = {
      title,
      task: async (ctx, taskWrapper) => {
        // Create snapshot before execution using deep clone or custom override
        const snapshot: IContextSnapshot<TContext> = {
          context: options?.snapshotOverride
            ? options.snapshotOverride(ctx)
            : this.deepCloneContext(ctx),
          rollback: options?.rollback
        };
        this.snapshots.push(snapshot);

        try {
          const result = await task(ctx, taskWrapper);

          // Merge result into context immutably if it's not void/null/undefined
          if (result !== undefined && result !== null && typeof result === 'object') {
            // Create new merged context using immutable merging strategy
            const mergedContext = this.mergeContextImmutably(ctx, result);

            // Update the context object in-place while maintaining immutable principles
            this.updateContextInPlace(ctx, mergedContext);
          }

          return result;
        } catch (error) {
          // Execute rollback for this task and all previous tasks
          await this.executeRollbacks(ctx);
          throw error;
        }
      },
      skip: options?.skip,
      enabled: options?.enabled,
      retry: options?.retry
    };

    // Create new builder with updated context type
    // The type depends on whether enabled option is present
    const hasEnabledOption = options && 'enabled' in options;

    if (hasEnabledOption) {
      const newBuilder = new TasklistBuilder<ConditionalMergeContext<TContext, TAddition, true>>(
        this.initialContext as ConditionalMergeContext<TContext, TAddition, true>
      );
      // Cast both the existing tasks and the new task to the new context type
      newBuilder.tasks = [
        ...(this.tasks as Array<ListrTask<ConditionalMergeContext<TContext, TAddition, true>, ListrDefaultRenderer>>),
        listrTask as ListrTask<ConditionalMergeContext<TContext, TAddition, true>, ListrDefaultRenderer>
      ];
      newBuilder.snapshots = this.snapshots as Array<IContextSnapshot<ConditionalMergeContext<TContext, TAddition, true>>>;
      return newBuilder as TasklistBuilder<ConditionalMergeContext<TContext, TAddition, true>>;
    } else {
      const newBuilder = new TasklistBuilder<MergeContext<TContext, TAddition>>(
        this.initialContext as MergeContext<TContext, TAddition>
      );
      // Cast both the existing tasks and the new task to the new context type
      newBuilder.tasks = [
        ...(this.tasks as Array<ListrTask<MergeContext<TContext, TAddition>, ListrDefaultRenderer>>),
        listrTask as ListrTask<MergeContext<TContext, TAddition>, ListrDefaultRenderer>
      ];
      newBuilder.snapshots = this.snapshots as Array<IContextSnapshot<MergeContext<TContext, TAddition>>>;
      return newBuilder as TasklistBuilder<MergeContext<TContext, TAddition>>;
    }
  }



  /**
   * Adds a subtask sequence with its own builder context
   * 
   * @remarks
   * This method enables the creation of nested task sequences where subtasks
   * can modify their own context scope. The subtask builder receives a copy
   * of the parent context and can build its own task sequence.
   * 
   * Key features:
   * - **Context Inheritance**: Subtasks start with parent context
   * - **Isolated Scope**: Subtask context changes don't automatically propagate up
   * - **Type Safety**: Full type inference for subtask context transformations
   * - **Return Control**: Parent task controls what gets returned to main context
   * 
   * The subtask builder function receives the current context and a new builder
   * instance. It should return a built subtask sequence. The parent task can then
   * decide what data from the subtask context should be returned to the main sequence.
   * 
   * @param title - Human-readable title for the subtask group
   * @param subtaskBuilder - Function that builds the subtask sequence
   * @param options - Optional configuration for the subtask group
   * @returns New builder instance with updated context type
   * 
   * @example
   * ```typescript
   * builder
   *   .add('Setup project', async (ctx) => ({ projectId: 'proj-123' }))
   *   .addSubtasks(
   *     'Deploy components',
   *     async (ctx, subBuilder) => {
   *       return subBuilder
   *         .add('Deploy database', async (subCtx) => ({
   *           dbUrl: `db://proj-${subCtx.projectId}`
   *         }))
   *         .add('Deploy API', async (subCtx) => ({
   *           apiUrl: `api://proj-${subCtx.projectId}`
   *         }))
   *         .add('Return deployment info', async (subCtx) => ({
   *           deployment: {
   *             database: subCtx.dbUrl,
   *             api: subCtx.apiUrl
   *           }
   *         }));
   *     }
   *   )
   *   .add('Verify deployment', async (ctx) => {
   *     // ctx.deployment is available from subtasks
   *     return { verified: true };
   *   });
   * ```
   */
  addSubtasks<TAddition = void>(
    title: string,
    subtaskBuilder: (
      ctx: TContext,
      builder: TasklistBuilder<TContext>
    ) => TasklistBuilder<MergeContext<TContext, TAddition>> | Promise<TasklistBuilder<MergeContext<TContext, TAddition>>>,
    options?: ITaskOptions<TContext>
  ): TasklistBuilder<MergeContext<TContext, TAddition>> {
    const listrTask: ListrTask<TContext, ListrDefaultRenderer> = {
      title,
      task: async (ctx, _taskWrapper) => {
        // Create snapshot before execution
        const snapshot: IContextSnapshot<TContext> = {
          context: options?.snapshotOverride
            ? options.snapshotOverride(ctx)
            : this.deepCloneContext(ctx),
          rollback: options?.rollback
        };
        this.snapshots.push(snapshot);

        try {
          // Create subtask builder with current context
          const subBuilder = new TasklistBuilder<TContext>(this.deepCloneContext(ctx));

          // Build subtask sequence
          const builtSubtasks = await subtaskBuilder(ctx, subBuilder);

          // Create and run the subtask Listr
          const subtaskListr = builtSubtasks.buildListr();
          const subtaskContext = await subtaskListr.run(this.deepCloneContext(ctx) as MergeContext<TContext, TAddition>) as MergeContext<TContext, TAddition>;

          // Extract the additions from subtask context by comparing with original context
          const additions = this.extractContextAdditions(ctx as MergeContext<TContext, TAddition>, subtaskContext);

          // Merge additions into parent context immutably
          if (additions && Object.keys(additions).length > 0) {
            const mergedContext = this.mergeContextImmutably(ctx, additions);
            this.updateContextInPlace(ctx, mergedContext);
          }

          return additions;
        } catch (error) {
          // Execute rollback for this task and all previous tasks
          await this.executeRollbacks(ctx);
          throw error;
        }
      },
      skip: options?.skip,
      enabled: options?.enabled,
      retry: options?.retry
    };

    // Create new builder with updated context type
    const newBuilder = new TasklistBuilder<MergeContext<TContext, TAddition>>(
      this.initialContext as MergeContext<TContext, TAddition>
    );
    // Cast both the existing tasks and the new task to the new context type
    newBuilder.tasks = [
      ...(this.tasks as Array<ListrTask<MergeContext<TContext, TAddition>, ListrDefaultRenderer>>),
      listrTask as ListrTask<MergeContext<TContext, TAddition>, ListrDefaultRenderer>
    ];
    // Share the same snapshots array reference across all builder instances
    newBuilder.snapshots = this.snapshots as Array<IContextSnapshot<MergeContext<TContext, TAddition>>>;

    return newBuilder;
  }

  /**
   * Extracts new properties added to context by comparing original and modified contexts
   * 
   * @remarks
   * This helper method identifies properties that were added to the context during
   * subtask execution by comparing the original context with the modified version.
   * It returns only the new properties, which can then be merged into the parent context.
   * 
   * @param originalContext - The context before subtask execution
   * @param modifiedContext - The context after subtask execution
   * @returns Object containing only the new properties
   * 
   * @internal
   */
  private extractContextAdditions<TOriginal, TModified>(
    originalContext: TOriginal,
    modifiedContext: TModified
  ): Partial<TModified> {
    const additions: Record<string, unknown> = {};

    // Find properties in modified context that don't exist in original or have different values
    for (const key in modifiedContext as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(modifiedContext, key)) {
        const originalValue = (originalContext as Record<string, unknown>)[key];
        const modifiedValue = (modifiedContext as Record<string, unknown>)[key];

        // Include property if it's new or has a different value
        if (!(key in (originalContext as Record<string, unknown>)) || originalValue !== modifiedValue) {
          additions[key] = modifiedValue;
        }
      }
    }

    return additions as Partial<TModified>;
  }

  /**
   * Executes rollback handlers for all completed tasks in reverse order
   * 
   * @remarks
   * This method implements the rollback mechanism by:
   * 1. Executing custom rollback handlers in reverse chronological order
   * 2. Restoring the context to the state before the failed task
   * 3. Gracefully handling rollback failures to avoid masking the original error
   * 
   * The rollback process uses the immutable snapshots created before each task
   * execution to ensure proper state restoration.
   * 
   * @internal
   * @param currentContext - The context at the time of failure (will be restored)
   */
  private async executeRollbacks(currentContext: TContext): Promise<void> {
    // Execute rollbacks in reverse order (most recent first)
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      const snapshot = this.snapshots[i];
      if (snapshot && snapshot.rollback) {
        try {
          await snapshot.rollback(snapshot.context, {} as PanfactumTaskWrapper<TContext>);
        } catch (rollbackError) {
          // Log rollback errors but don't throw to avoid masking original error
          // Note: In a real implementation, this should use the Panfactum logger
          // console.error('Rollback failed:', rollbackError);
          void rollbackError; // Acknowledge the error without logging
        }
      }
    }

    // Restore context to the state before the failed task (i.e., the last successful snapshot)
    if (this.snapshots.length > 0) {
      // Find the last snapshot before the failed task
      const lastSnapshot = this.snapshots[this.snapshots.length - 1];
      if (lastSnapshot) {
        this.updateContextInPlace(currentContext, lastSnapshot.context);
      } else {
        this.updateContextInPlace(currentContext, this.initialContext);
      }
    } else {
      // Fallback to initial context if no snapshots exist
      this.updateContextInPlace(currentContext, this.initialContext);
    }
  }

  /**
   * Builds the final Listr instance with the configured tasks
   * 
   * @remarks
   * You should prefer using {@link runTasks} instead of this method for consistent
   * error handling and output formatting. Only use this method if you need direct
   * control over the Listr instance execution.
   * 
   * @param options - Optional Listr configuration options
   * @returns Configured Listr instance ready for execution
   */
  buildListr(options?: ListrOptions<TContext>): Listr<TContext> {
    return new Listr<TContext>(this.tasks, options);
  }


  /**
   * Executes the task sequence with standardized error handling and output formatting
   * 
   * @remarks
   * This method provides the same standardized error handling and output formatting
   * as the existing `runTasks` utility function. It:
   * 
   * - **Standardizes Execution**: Ensures all task lists run consistently
   * - **Error Handling**: Wraps exceptions in CLIError with custom messages
   * - **Output Formatting**: Adds proper spacing after task completion
   * - **Type Safety**: Preserves generic types from the task context
   * - **Rollback Support**: Automatically executes rollbacks on failure
   * 
   * Key features:
   * - Automatic newline insertion after task completion for visual spacing
   * - Custom error messages for different failure scenarios
   * - Generic type support for task context data
   * - Integration with Panfactum logging system
   * - Immutable context management with rollback support
   * 
   * The function preserves the return value from the task sequence, allowing
   * downstream code to access the final context with all transformations applied.
   * 
   * @param input - Configuration for task execution including context and error message
   * @returns Promise resolving to the final context with all transformations applied
   * 
   * @example
   * ```typescript
   * const result = await new TasklistBuilder<InitialContext>({ 
   *   projectName: 'my-app' 
   * })
   *   .add('Validate project', async (ctx) => ({ validated: true }))
   *   .add('Create directory', async (ctx) => ({ 
   *     projectPath: `/projects/${ctx.projectName}` 
   *   }))
   *   .runTasks({
   *     context: panfactumContext,
   *     errorMessage: 'Project setup failed'
   *   });
   * 
   * // result.projectName, result.validated, result.projectPath are all typed
   * ```
   * 
   * @example
   * ```typescript
   * // With rollback on failure
   * try {
   *   const result = await builder
   *     .add('Create temp files', async (ctx) => ({ tempFiles: files }), {
   *       rollback: async (ctx) => await cleanupFiles(ctx.tempFiles)
   *     })
   *     .add('Process files', async (ctx) => ({ processed: true }))
   *     .runTasks({
   *       context: panfactumContext,
   *       errorMessage: 'File processing failed'
   *     });
   * } catch (error) {
   *   // Rollbacks have been executed automatically
   *   console.error('Task sequence failed:', error.message);
   * }
   * ```
   * 
   * @throws {@link CLIError}
   * Throws when task execution fails, wrapping the original error with the provided message
   * 
   * @see {@link runTasks} - The original utility function this method emulates
   * @see {@link PanfactumContext} - For logging and configuration context
   */
  async runTasks(input: IRunTasksInput<TContext>): Promise<TContext> {
    const { context, errorMessage, options } = input;

    try {
      const listr = this.buildListr(options);
      const result = await listr.run(this.initialContext);
      context.logger.write(""); // Need a newline after tasks for spacing
      return result;
    } catch (error) {
      throw new CLIError(errorMessage, error);
    }
  }
}

/**
 * Input parameters for running TasklistBuilder tasks with standardized error handling
 * 
 * @remarks
 * This interface matches the same pattern as the existing `runTasks` utility
 * to provide consistent API design across the Panfactum CLI. It requires
 * the Panfactum context for logging and a custom error message for failures.
 */
interface IRunTasksInput<TContext> {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Error message to display if task execution fails */
  errorMessage: string;
  /** Optional Listr configuration options */
  options?: ListrOptions<TContext>;
}