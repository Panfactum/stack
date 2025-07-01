// This file provides an adapter to integrate Inquirer prompts with Listr2 tasks
// It allows prompts to be displayed within the context of running tasks

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListrPromptAdapter, ListrTaskEventType, ListrTaskState } from 'listr2'
import pc from "picocolors";
import type { Prompt } from '@inquirer/type'

/**
 * Adapter for running Inquirer prompts within Listr2 tasks
 * 
 * @remarks
 * This adapter extends Listr's prompt functionality to work with Inquirer.js
 * prompts. It provides:
 * - Integration between Inquirer prompts and Listr task output
 * - Visual feedback showing "Waiting on user input" during prompts
 * - Proper cancellation handling when tasks are skipped
 * - Automatic cleanup and state management
 * 
 * The adapter animates the task title while waiting for user input to make
 * it clear the CLI is waiting for interaction, not frozen.
 * 
 * @example
 * ```typescript
 * const task = {
 *   title: 'Configure settings',
 *   task: async (ctx, task) => {
 *     const name = await task.prompt(ListrInquirerPromptAdapter)
 *       .run(input, {
 *         message: 'What is your name?'
 *       });
 *     ctx.name = name;
 *   }
 * };
 * ```
 * 
 * @see {@link ListrPromptAdapter} - Base adapter class from Listr2
 * @see {@link Logger} - Uses this adapter for prompt integration
 */
export class ListrInquirerPromptAdapter extends ListrPromptAdapter {
  /** Current running prompt promise */
  private prompt: Promise<any> | undefined
  /** Controller for cancelling prompts */
  private abortController = new globalThis.AbortController();
  
  /**
   * Gets the current running instance of the Inquirer prompt
   * 
   * @returns The promise for the current prompt, or undefined if no prompt is running
   */
  get instance(): Promise<any> | undefined {
    return this.prompt
  }

  /**
   * Creates and runs a new Inquirer prompt within the Listr task context
   * 
   * @remarks
   * This method:
   * 1. Sets up the prompt with proper output redirection to Listr
   * 2. Monitors task state to cancel prompts if the task is skipped
   * 3. Animates the task title to show "Waiting on user input"
   * 4. Handles cancellation and cleanup properly
   * 
   * @param prompt - The Inquirer prompt function to run
   * @param config - Configuration for the prompt
   * @param context - Context object with output stream
   * @returns Promise resolving to the user's answer
   * 
   * @throws Propagates any errors from the prompt execution
   */
  public async run<T extends Prompt<any, any>>(prompt: T, ...[config, context]: Parameters<T>): Promise<ReturnType<T>> {
    context ??= {}
    context.output ??= this.wrapper.stdout(ListrTaskEventType.PROMPT)

    this.reportStarted()

    this.task.on(ListrTaskEventType.STATE, (event) => {
      if (event === ListrTaskState.SKIPPED && this.prompt) {
        this.cancel()
      }
    })

    this.prompt = prompt(config, { ...context, signal: this.abortController.signal })

    const originalTitle = this.task.title

    // Animate the task title to show we're waiting for input
    let styled = false;
    const interval = globalThis.setInterval(() => {
      if (styled) {
        this.task.title = originalTitle + " " + pc.bold(pc.whiteBright(pc.bgBlackBright(" Waiting on user input ")))
      } else {
        this.task.title = originalTitle + " " + pc.bold(pc.dim(pc.black(pc.bgWhiteBright(" Waiting on user input "))))
      }
      styled = !styled;
    }, 1000)

    let result: ReturnType<T>


    try {
      result = await this.prompt

      this.reportCompleted()
    } catch (e) {
      this.reportFailed()

      throw e
    } finally {
      globalThis.clearInterval(interval)
      this.task.title = originalTitle
    }

    return result
  }

  /**
   * Cancels the currently running prompt
   * 
   * @remarks
   * Uses an AbortController to signal cancellation to the Inquirer prompt.
   * This is called automatically when the parent task is skipped.
   */
  public cancel(): void {
    // there's no prompt, can't cancel
    if (!this.prompt) {
      return
    }

    this.reportFailed()

    this.abortController.abort()
  }
}