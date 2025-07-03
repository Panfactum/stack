// This file provides a unified export interface for all Listr2 utilities in the Panfactum CLI
// It consolidates the type-safe TasklistBuilder with existing utilities for clean imports

// Export the new type-safe builder
export { TasklistBuilder } from "./TasklistBuilder";

// Export existing utilities for backward compatibility
export { runTasks } from "./runTasks";
export type { PanfactumTaskWrapper } from "./types";

// Re-export commonly used Listr2 types for convenience
export type { Listr, ListrTask, ListrTaskWrapper } from "listr2";

/**
 * @fileoverview
 * 
 * This module provides a comprehensive set of utilities for working with Listr2 
 * task sequences in the Panfactum CLI. It includes both the new type-safe 
 * ListrContextBuilder and the existing utilities.
 * 
 * ## Key Exports
 * 
 * ### Type-Safe Builder (Primary Interface)
 * - `TasklistBuilder` - Type-safe task sequence builder with immutable context management
 * 
 * ### Legacy Utilities (Backward Compatibility)
 * - `runTasks` - Original utility function for running task sequences
 * - `PanfactumTaskWrapper` - Type alias for Panfactum-specific task wrappers
 * 
 * ### Listr2 Re-exports (Convenience)
 * - `Listr` - Main Listr2 class
 * - `ListrTask` - Individual task interface
 * - `ListrTaskWrapper` - Task wrapper for task functions
 * 
 * ## Migration Guide
 * 
 * ### Current Usage (Legacy)
 * ```typescript
 * import { runTasks } from "@/util/listr";
 * import { Listr } from "listr2";
 * 
 * const tasks = new Listr([
 *   { title: "Task 1", task: (ctx) => { ctx.result = "done"; } }
 * ]);
 * 
 * await runTasks({
 *   context: panfactumContext,
 *   tasks,
 *   errorMessage: "Tasks failed"
 * });
 * ```
 * 
 * ### New Usage (Type-Safe Builder)
 * ```typescript
 * import { TasklistBuilder } from "@/util/listr";
 * 
 * const result = await new TasklistBuilder({ projectName: "my-app" })
 *   .addTask("Task 1", async (ctx) => ({ result: "done" }))
 *   .addTask("Log progress", async (ctx) => {
 *     console.log(ctx.result); // Side effect - no return
 *   })
 *   .addTask("Task 2", async (ctx) => {
 *     // ctx.result is typed and available
 *     return { completed: true };
 *   })
 *   .runTasks({
 *     context: panfactumContext,
 *     errorMessage: "Tasks failed"
 *   });
 * 
 * // result.projectName, result.result, result.completed are all typed
 * ```
 * 
 * ## Benefits of the Type-Safe Builder
 * 
 * 1. **Compile-Time Type Safety**: Context transformations are tracked at compile time
 * 2. **Immutable Context Management**: No accidental mutations, predictable state changes
 * 3. **Rollback Support**: Automatic snapshots and rollback mechanisms
 * 4. **Method Chaining**: Fluent API for building complex task sequences
 * 5. **Multiple Task Types**: Support for regular tasks, side effects, conditionals, and subtasks
 * 6. **IDE Support**: Full IntelliSense and auto-completion for context properties
 * 
 * @example Basic Usage
 * ```typescript
 * import { TasklistBuilder } from "@/util/listr";
 * 
 * interface ProjectContext {
 *   name: string;
 * }
 * 
 * const result = await new TasklistBuilder<ProjectContext>({ name: "my-project" })
 *   .addTask("Validate name", async (ctx) => {
 *     if (!ctx.name) throw new Error("Name required");
 *     return { validated: true };
 *   })
 *   .addTask(
 *     "Create backup", 
 *     async (ctx) => ({ backupPath: `/backups/${ctx.name}` }),
 *     { enabled: (ctx) => ctx.validated }
 *   )
 *   .runTasks({
 *     context: panfactumContext,
 *     errorMessage: "Project setup failed"
 *   });
 * ```
 * 
 * @example Advanced Usage with Subtasks
 * ```typescript
 * import { TasklistBuilder } from "@/util/listr";
 * 
 * const result = await new TasklistBuilder({ projectId: "proj-123" })
 *   .addSubtasks("Deploy infrastructure", async (ctx, builder) => {
 *     return builder
 *       .addTask("Deploy database", async () => ({ dbUrl: "db://..." }))
 *       .addTask("Deploy API", async (subCtx) => ({ 
 *         apiUrl: `api://${subCtx.projectId}` 
 *       }));
 *   })
 *   .addTask("Verify deployment", async (ctx) => {
 *     // ctx.dbUrl and ctx.apiUrl are available from subtasks
 *     return { deploymentVerified: true };
 *   })
 *   .runTasks({
 *     context: panfactumContext,
 *     errorMessage: "Deployment failed"
 *   });
 * ```
 */