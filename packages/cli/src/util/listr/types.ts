// This file defines type aliases for Listr2 task wrappers used throughout the CLI
// It provides consistent typing for task functions and renderers

import type { DefaultRenderer, ListrTaskWrapper, SimpleRenderer } from "listr2";

/**
 * Panfactum-specific task wrapper type for Listr2 tasks
 * 
 * @remarks
 * This type alias standardizes the task wrapper interface used throughout
 * the Panfactum CLI. It configures the task wrapper to use both the default
 * and simple renderers from Listr2, providing flexibility in how tasks are
 * displayed to users.
 * 
 * Key features:
 * - **Dual Renderer Support**: Works with both DefaultRenderer and SimpleRenderer
 * - **Generic Context**: Supports typed task context data
 * - **Standardized Interface**: Ensures consistent task wrapper usage
 * 
 * The type accepts an optional generic parameter for the task context,
 * allowing tasks to work with typed data structures while maintaining
 * type safety throughout the task execution pipeline.
 * 
 * Common use cases:
 * - Task function parameter typing
 * - Task context manipulation
 * - Progress reporting within tasks
 * - Subtask creation and management
 * 
 * @example
 * ```typescript
 * // Simple task without context
 * const myTask = (task: PanfactumTaskWrapper) => {
 *   task.title = 'Processing...';
 *   // Perform work
 * };
 * ```
 * 
 * @example
 * ```typescript
 * // Task with typed context
 * interface TaskContext {
 *   step: number;
 *   data: string[];
 * }
 * 
 * const typedTask = (task: PanfactumTaskWrapper<TaskContext>) => {
 *   task.title = `Step ${task.task.data.step}`;
 *   // Access typed context data
 * };
 * ```
 * 
 * @see {@link ListrTaskWrapper} - Base Listr2 task wrapper interface
 * @see {@link DefaultRenderer} - Default Listr2 task renderer
 * @see {@link SimpleRenderer} - Simple Listr2 task renderer
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PanfactumTaskWrapper<Ctx = any | undefined> = ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>