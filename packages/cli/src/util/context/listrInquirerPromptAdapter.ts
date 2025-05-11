/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListrPromptAdapter, ListrTaskEventType, ListrTaskState } from 'listr2'
import pc from "picocolors";
import type { Prompt } from '@inquirer/type'

export class ListrInquirerPromptAdapter extends ListrPromptAdapter {
  private prompt: Promise<any> | undefined
  private abortController = new globalThis.AbortController();
  /**
   * Get the current running instance of `inquirer`.
   */
  get instance(): Promise<any> | undefined {
    return this.prompt
  }

  /**
   * Create a new prompt with `inquirer`.
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
   * Cancel the ongoing prompt.
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