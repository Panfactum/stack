// This file provides the Logger class for formatted console output in the Panfactum CLI
// It handles text styling, line wrapping, user prompts, and terminal formatting

import { Writable } from "node:stream";
import { input, confirm, search, checkbox, select, password } from "@inquirer/prompts";
import pc from "picocolors";
import { dedent } from "@/util/util/dedent";
import { ListrInquirerPromptAdapter } from "./listrInquirerPromptAdapter";
import { breakpoints } from "./teminal-columns/breakpoints";
import { terminalColumns } from "./teminal-columns/terminalColumns";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

/** Maximum width for terminal output formatting */
const MAX_WIDTH = 100

/**
 * Configuration for Inquirer theme settings
 */
interface IInquirerThemeConfig {
  /** Optional task wrapper for context */
  task?: PanfactumTaskWrapper;
  /** Whether to place answer on same line as question */
  answerSameLine?: boolean;
}



/**
 * Available color styles for text formatting
 */
type ColorStyle = "default" | "warning" | "important" | "question" | "error" | "success" | "subtle"

/**
 * Configuration for highlighting specific phrases in text
 */
type HighlightsConfig = {
  /** Phrases to highlight with important style */
  highlights?: string[],
  /** Phrases to highlight with subtle style */
  lowlights?: string[],
  /** Phrases to highlight with error style */
  badlights?: string[]
}

/**
 * Interface for applyColors method configuration
 */
interface IApplyColorsConfig extends HighlightsConfig {
  /** Color style to apply to the text */
  style?: ColorStyle;
  /** Whether to apply bold formatting */
  bold?: boolean;
  /** Whether to disable automatic highlighting */
  highlighterDisabled?: boolean;
  /** Whether to dedent the text */
  dedent?: boolean;
}

const DEFAULT_BREAKPOINTS = breakpoints({
  [`>= ${MAX_WIDTH + 4}`]: [4, MAX_WIDTH],
  ">= 0": [{ width: 0, preprocess: () => "" }, "auto"]
})

/**
 * Panfactum CLI logger for formatted console output
 * 
 * @remarks
 * The Logger class provides a comprehensive set of methods for:
 * - Formatted console output with consistent styling
 * - Interactive prompts with Inquirer.js integration
 * - Automatic text wrapping and terminal width handling
 * - Color highlighting with context-aware styling
 * - Integration with Listr task runners
 * - Debug logging capabilities
 * 
 * The logger maintains a list of "identifiers" (important strings like
 * environment names) that are automatically highlighted in all output.
 * 
 * @example
 * ```typescript
 * const logger = new Logger(process.stderr, true);
 * logger.addIdentifier("production");
 * logger.info("Deploying to production environment");
 * // "production" will be automatically highlighted
 * 
 * const name = await logger.input({
 *   message: "What is your name?",
 *   default: "Anonymous"
 * });
 * ```
 * 
 * @see {@link PanfactumContext} - Context object that includes a logger instance
 */
export class Logger {
  private stream: Writable;
  private debugEnabled: boolean;
  private identifiers: string[] = [];

  constructor(
    stream: Writable,
    debugEnabled: boolean
  ) {
    this.stream = stream;
    this.debugEnabled = debugEnabled;
  }

  /**
   * Logs debug information when debug mode is enabled
   * 
   * @remarks
   * Debug events are captured for crash logs but not shown
   * to users during normal operation. They're only visible
   * when the --debug flag is passed to the CLI.
   * 
   * @param action - The debug action or event to log
   * @param _ - Optional metadata associated with the event
   * 
   * @internal
   */
  public debug(action: string, _?: Record<string, unknown>) {
    if (this.debugEnabled) {
      this.stream.write(action)
    }
  }

  /**
   * Adds a string to be automatically highlighted in all logger output
   * 
   * @remarks
   * Identifiers are important strings (like environment names, account IDs,
   * or domain names) that should be visually distinct in all log messages.
   * Once added, these strings will be automatically highlighted whenever
   * they appear in logger output.
   * 
   * Empty strings are ignored to prevent highlighting issues.
   * 
   * @param str - The identifier string to highlight
   * 
   * @example
   * ```typescript
   * logger.addIdentifier("prod-cluster");
   * logger.info("Connecting to prod-cluster");
   * // "prod-cluster" will be highlighted
   * ```
   */
  public addIdentifier(str: string) {
    if (str.trim().length > 0) {
      this.identifiers.push(str)
    }
  }

  /**
   * Removes a string from the automatic highlighting list
   * 
   * @param str - The identifier string to stop highlighting
   */
  public removeIdentifier(str: string) {
    this.identifiers = this.identifiers.filter(identifier => identifier !== str)
  }

  /**
   * Applies color styling and highlighting to text
   * 
   * @remarks
   * This method provides advanced text coloring with:
   * - Standard color styles (error, warning, success, etc.)
   * - Context-aware highlighting of specific phrases
   * - Automatic highlighting of registered identifiers
   * - Conflict resolution for overlapping highlights
   * - Optional text dedenting
   * 
   * Highlights are applied with priority:
   * 1. Explicit highlights/lowlights/badlights from config
   * 2. Automatic identifier highlights
   * 3. Longer phrases take precedence over shorter ones at the same position
   * 
   * @param str - The text to style
   * @param config - Configuration for styling and highlighting
   * @returns The styled text with ANSI color codes
   * 
   * @example
   * ```typescript
   * const styled = logger.applyColors("Deploy to production failed", {
   *   style: "error",
   *   highlights: ["production"],
   *   badlights: ["failed"]
   * });
   * ```
   */
  public applyColors(str: string, config?: IApplyColorsConfig) {
    // Handle null/undefined gracefully
    if (str === null || str === undefined) {
      str = String(str);
    }

    // Return empty strings immediately without applying any color styling
    if (str === "") {
      return str;
    }

    const {
      style = "default",
      bold,
      highlights = [],
      lowlights = [],
      badlights = [],
      highlighterDisabled = false,
      dedent: shouldDedent = false,
    } = config || {}

    let resultStr = this.getColorFn(style)(shouldDedent ? dedent(str) : str)

    if (bold) {
      resultStr = pc.bold(resultStr)
    }

    if (highlighterDisabled) {
      return resultStr;
    }

    // Allow the highlights that are passed to this function
    // to override the identifier highlights
    const identifierHighlights = this.identifiers
      .filter(identifier =>
        !highlights.some((highlight) => (highlight === identifier)) &&
        !lowlights.some((lowlight) => (lowlight === identifier)) &&
        !badlights.some((badlight) => (badlight === identifier))
      )

    const allHighlights: { phrase: string, style: ColorStyle }[] = identifierHighlights
      .concat(highlights).map(highlight => ({ phrase: highlight, style: "important" as ColorStyle }))
      .concat(lowlights.map(lowlight => ({ phrase: lowlight, style: "subtle" as ColorStyle })))
      .concat(badlights.map(badlight => ({ phrase: badlight, style: "error" as ColorStyle })))



    // Process highlights more efficiently by using a single pass approach
    if (allHighlights && allHighlights.length > 0) {
      // Create a map of positions to highlight information
      const positions: Array<{
        start: number;
        end: number;
        style: ColorStyle;
        phrase: string;
      }> = [];

      // Find all occurrences of each highlight phrase
      for (const highlight of allHighlights) {
        const phrase = typeof highlight === "string" ? highlight : highlight.phrase;
        const highlightStyle = typeof highlight === "string" ? "important" : highlight.style;

        let pos = 0;
        while ((pos = resultStr.indexOf(phrase, pos)) !== -1) {
          positions.push({
            start: pos,
            end: pos + phrase.length,
            style: highlightStyle,
            phrase
          });
          pos += 1; // Move past this occurrence
        }
      }

      // Sort positions by start index, then by phrase length (descending) to prioritize longer phrases
      positions.sort((a, b) => {
        if (a.start !== b.start) {
          return a.start - b.start;
        }
        // If two highlights start at the same position, prioritize the longer one
        return b.phrase.length - a.phrase.length;
      });

      // Merge overlapping highlights (prioritize earlier ones and longer phrases at same position)
      const mergedPositions: typeof positions = [];
      for (const pos of positions) {
        const last = mergedPositions[mergedPositions.length - 1];
        if (last && pos.start < last.end) {
          // Skip this highlight as it overlaps with a previous one
          continue;
        }
        mergedPositions.push(pos);
      }

      // Apply highlights in a single pass
      if (mergedPositions.length > 0) {
        let result = "";
        let lastEnd = 0;

        for (const { start, end, style: highlightStyle } of mergedPositions) {
          // Add text before this highlight with the base style
          if (start > lastEnd) {
            result += this.getColorFn(style)(resultStr.substring(lastEnd, start));
          }

          // Add the highlighted text
          result += this.getColorFn(highlightStyle, style)(resultStr.substring(start, end));
          lastEnd = end;
        }

        // Add any remaining text with the base style
        if (lastEnd < resultStr.length) {
          result += this.getColorFn(style)(resultStr.substring(lastEnd));
        }

        resultStr = result;
      }

      // Return early since we've processed all highlights
      return bold ? pc.bold(resultStr) : resultStr;
    }

    return resultStr;
  }

  /**
   * Gets the color function for a given style
   * 
   * @remarks
   * Returns a function that applies ANSI color codes for the specified style.
   * When highlighting within an already-styled context, the baseStyle parameter
   * ensures highlights are visible against the background color.
   * 
   * @param style - The color style to apply
   * @param baseStyle - The base style context (for nested highlighting)
   * @returns Function that applies the color to a string
   * 
   * @internal
   */
  public getColorFn(style: ColorStyle, baseStyle?: ColorStyle) {

    switch (style) {
      case "error": {
        return pc.red
      }
      case "warning": {
        return pc.yellow
      }
      case "important": {
        switch (baseStyle) {
          case "warning": {
            return (str: string) => pc.bold(pc.yellowBright(str))
          }
          case "question": {
            return (str: string) => pc.bold(pc.magentaBright(str))
          }
          case "error": {
            return (str: string) => pc.bold(pc.redBright(str))
          }
          case "success": {
            return (str: string) => pc.bold(pc.greenBright(str))
          }
          default: {
            return (str: string) => pc.bold(pc.whiteBright(str))
          }
        }
      }
      case "success": {
        return pc.green
      }
      case "default": {
        return pc.white
      }
      case "subtle": {
        return pc.gray
      }
      case "question": {
        return pc.magenta
      }
    }
  }

  /**
   * Logs an informational message with an info icon
   * 
   * @param str - The message to log
   * @param config - Optional highlighting configuration
   * 
   * @example
   * ```typescript
   * logger.info("Deployment completed successfully", {
   *   highlights: ["successfully"]
   * });
   * ```
   */
  public info(str: string, config?: HighlightsConfig) {
    this.stream.write(terminalColumns([[
      this.applyColors("🛈", { style: "important" }),
      this.applyColors(str, { style: "default", dedent: true, ...config })
    ]], DEFAULT_BREAKPOINTS))
    this.stream.write("\n\n")
  }

  /**
   * Logs a warning message with a warning icon
   * 
   * @param str - The warning message to log
   * @param config - Optional highlighting configuration
   */
  public warn(str: string, config?: HighlightsConfig) {
    this.stream.write(terminalColumns([[
      this.applyColors(" ❗", { style: "warning" }),
      this.applyColors(str, { style: "warning", dedent: true, ...config })
    ]], DEFAULT_BREAKPOINTS))
    this.stream.write("\n\n")
  }

  /**
   * Logs a success message with a checkmark icon
   * 
   * @param str - The success message to log
   * @param config - Optional highlighting configuration
   */
  public success(str: string, config?: HighlightsConfig) {
    this.stream.write(terminalColumns([[
      this.applyColors("✓", { style: "success" }),
      this.applyColors(str, { style: "success", dedent: true, ...config })
    ]], DEFAULT_BREAKPOINTS))
    this.stream.write("\n\n")
  }

  /**
   * Logs an error message with an error icon
   * 
   * @param str - The error message to log
   * @param config - Optional highlighting configuration
   */
  public error(str: string, config?: HighlightsConfig) {
    this.stream.write(terminalColumns([[
      this.applyColors("🆇", { style: "error" }),
      this.applyColors(str, { style: "error", dedent: true, ...config })
    ]], DEFAULT_BREAKPOINTS))
    this.stream.write("\n\n")
  }

  /**
   * Writes styled text without an icon prefix
   * 
   * @param str - The text to write
   * @param config - Styling and highlighting configuration
   */
  public write(str: string, config?: HighlightsConfig & { style?: ColorStyle, removeIndent?: boolean }) {
    this.stream.write(terminalColumns([[
      "",
      this.applyColors(str, { style: "default", dedent: true, ...config })
    ]], config?.removeIndent ? [0, MAX_WIDTH] : DEFAULT_BREAKPOINTS))
    this.stream.write("\n\n")
  }

  /**
   * Writes raw text without any formatting or line wrapping
   * 
   * @param str - The raw text to write
   */
  public writeRaw(str: string) {
    this.stream.write(str)
    this.stream.write("\n\n")
  }

  /**
   * Writes a single newline to create vertical spacing
   */
  public line() {
    this.stream.write("\n")
  }

  /**
   * Prints explanatory text before a prompt
   * 
   * @param explainer - The explanatory text or configuration
   * @param task - Optional Listr task for output integration
   * 
   * @internal
   */
  private printExplainer(explainer?: string | { message: string } & HighlightsConfig, task?: PanfactumTaskWrapper) {
    if (explainer) {
      if (task) {
        if (typeof explainer === "string") {
          task.output = this.applyColors(dedent(explainer), { style: "warning", dedent: true })
        } else {
          task.output = this.applyColors(dedent(explainer.message), { style: "warning", dedent: true, ...explainer })
        }
      } else {
        if (typeof explainer === "string") {
          this.write(explainer)
        } else {
          this.write(explainer.message, explainer)
        }
      }
    }
  }

  private formatQuestionMessage(message: string | { message: string } & HighlightsConfig) {
    return typeof message === "string" ?
      this.applyColors(message, { style: "question" }) :
      this.applyColors(message.message, { style: "question", ...message })
  }

  private getDefaultInquirerTheme(config?: IInquirerThemeConfig) {
    const { answerSameLine = false, task } = config || {};

    return task ? {
      helpMode: "never" as const,
      prefix: { idle: this.applyColors("❓", { style: "question" }), done: this.applyColors("✓ ", { style: "question" }) }
    } : {
      helpMode: "never" as const,
      style: {
        message: (text: string, status: "idle" | "done" | "loading") => " " + text + (status === "done" || answerSameLine ? "" : "\n"),
        answer: (text: string) => " " + text,
        defaultAnswer: (text: string) => pc.italic(pc.gray(text)),
        description: (text: string) => (process.stdout.columns >= MAX_WIDTH + 4 ? "\n    " : "\n ") + pc.italic(text)
      },
      prefix: process.stdout.columns >= MAX_WIDTH + 4 ?
        { idle: this.applyColors("❓", { style: "question" }), done: this.applyColors("✓ ", { style: "question" }) } :
        { idle: "", done: "" }
    }
  }

  /**
   * Prompts for text input with enhanced styling and validation
   * 
   * @remarks
   * Wraps Inquirer's input prompt with:
   * - Automatic color styling
   * - Optional explainer text before the question
   * - Validation with styled error messages
   * - Listr task integration
   * - Automatic line spacing
   * 
   * @param config - Input prompt configuration
   * @returns Promise resolving to the user's input
   * 
   * @example
   * ```typescript
   * const name = await logger.input({
   *   message: "What is your project name?",
   *   default: "my-project",
   *   validate: (value) => value.length > 0 || "Name is required",
   *   explainer: "This will be used as the directory name"
   * });
   * ```
   */
  public input = (config: {
    message: string | { message: string } & HighlightsConfig;
    default?: string;
    required?: boolean;
    transformer?: (value: string, context: { isFinal: boolean }) => string;
    validate?: (value: string) => boolean | string | Promise<string | boolean>;
    explainer?: string | { message: string } & HighlightsConfig;
    task?: PanfactumTaskWrapper
  }) => {
    const { validate, message, explainer, task } = config;

    this.printExplainer(explainer, task)

    const wrappedConfig = {
      required: true,
      ...config,
      message: this.formatQuestionMessage(message),
      validate: validate ? async (val: string) => {
        const retVal = await validate(val)
        if (typeof retVal === "string") {
          return this.applyColors(retVal, { style: "error" })
        } else {
          return retVal
        }
      } : undefined,
      theme: this.getDefaultInquirerTheme({ task, answerSameLine: true })
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(input, wrappedConfig) :
      input(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  /**
   * Prompts for password input with masking
   * 
   * @param config - Password prompt configuration
   * @returns Promise resolving to the user's password
   */
  public password = (config: {
    message: string | { message: string } & HighlightsConfig;
    default?: string;
    required?: boolean;
    mask?: boolean | string;
    validate?: (value: string) => boolean | string | Promise<string | boolean>;
    explainer?: string | { message: string } & HighlightsConfig;

    task?: PanfactumTaskWrapper
  }) => {
    const { validate, message, explainer, task } = config;

    this.printExplainer(explainer, task)
    const wrappedConfig = {
      required: true,
      mask: true,
      ...config,
      message: this.formatQuestionMessage(message),
      validate: validate ? async (val: string) => {
        const retVal = await validate(val)
        if (typeof retVal === "string") {
          return this.applyColors(retVal, { style: "error" })
        } else {
          return retVal
        }
      } : undefined,
      theme: this.getDefaultInquirerTheme({ task, answerSameLine: true })
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(password, wrappedConfig) :
      password(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  /**
   * Prompts for selection from a list of choices
   * 
   * @param config - Select prompt configuration
   * @returns Promise resolving to the selected value
   * 
   * @example
   * ```typescript
   * const env = await logger.select({
   *   message: "Select environment",
   *   choices: [
   *     { name: "Production", value: "prod" },
   *     { name: "Staging", value: "stage" },
   *     { name: "Development", value: "dev" }
   *   ],
   *   default: "dev"
   * });
   * ```
   */
  public select = <T>(config: {
    message: string | { message: string } & HighlightsConfig;
    choices: Array<{ name: string; value: T; description?: string, disabled?: boolean | string }>;
    default?: T;
    explainer?: string | { message: string } & HighlightsConfig;
    task?: PanfactumTaskWrapper
  }) => {
    const { message, explainer, task } = config;

    this.printExplainer(explainer, task)

    const wrappedConfig = {
      ...config,
      message: this.formatQuestionMessage(message),
      theme: this.getDefaultInquirerTheme({ task })
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(select<T>, wrappedConfig) :
      select<T>(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  /**
   * Prompts for multiple selections with checkboxes
   * 
   * @param config - Checkbox prompt configuration
   * @returns Promise resolving to array of selected values
   */
  public checkbox = <T>(config: {
    message: string | { message: string } & HighlightsConfig;
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>;
    validate?: (choices: readonly { value: T; checked?: boolean }[]) => boolean | string | Promise<string | boolean>;
    instructions?: boolean | string;
    explainer?: string | { message: string } & HighlightsConfig;
    task?: PanfactumTaskWrapper
  }) => {
    const { validate, message, explainer, task } = config;

    this.printExplainer(explainer, task)

    const wrappedConfig = {
      instructions: false,
      ...config,
      message: this.formatQuestionMessage(message),
      validate: validate ? async (val: readonly { value: T; checked?: boolean }[]) => {
        const retVal = await validate(val)
        if (typeof retVal === "string") {
          return this.applyColors(retVal, { style: "error" })
        } else {
          return retVal
        }
      } : undefined,
      theme: this.getDefaultInquirerTheme({ task })
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(checkbox<T>, wrappedConfig) :
      checkbox<T>(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  /**
   * Prompts with searchable/filterable list of choices
   * 
   * @param config - Search prompt configuration
   * @returns Promise resolving to the selected value
   */
  public search = <T>(config: {
    message: string | { message: string } & HighlightsConfig;
    source: (term: string | undefined) => Promise<Array<{ name: string; value: T }>> | Array<{ name: string; value: T }>;
    default?: string;
    explainer?: string | { message: string } & HighlightsConfig;

    validate?: (value: T) => boolean | string | Promise<string | boolean>;
    task?: PanfactumTaskWrapper
  }) => {
    const { message, explainer, task, validate } = config;

    this.printExplainer(explainer, task)

    const wrappedConfig = {
      ...config,
      message: this.formatQuestionMessage(message),
      validate: validate ? async (val: T) => {
        const retVal = await validate(val)
        if (typeof retVal === "string") {
          return this.applyColors(retVal, { style: "error" })
        } else {
          return retVal
        }
      } : undefined,
      theme: this.getDefaultInquirerTheme({ task })
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(search<T>, wrappedConfig) :
      search<T>(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  /**
   * Prompts for yes/no confirmation
   * 
   * @param config - Confirm prompt configuration
   * @returns Promise resolving to boolean
   * 
   * @example
   * ```typescript
   * const proceed = await logger.confirm({
   *   message: "Do you want to continue?",
   *   default: true
   * });
   * ```
   */
  public confirm = (config: {
    message: string | { message: string } & HighlightsConfig;
    default?: boolean;
    explainer?: string | { message: string } & HighlightsConfig;
    task?: PanfactumTaskWrapper
  }) => {
    const { message, explainer, task } = config;

    this.printExplainer(explainer, task)

    const wrappedConfig = {
      ...config,
      message: this.formatQuestionMessage(message),
      theme: this.getDefaultInquirerTheme({ task, answerSameLine: true })
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(confirm, wrappedConfig) :
      confirm(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }


  /**
   * Displays a standardized crash message with help resources
   * 
   * @remarks
   * Shows links to Discord for support and GitHub for bug reports.
   * Called automatically when the CLI encounters a fatal error.
   */
  public crashMessage() {
    this.error(`
      Get Help ==================================================

      If you need assistance, connect with us on our discord server: https://discord.gg/MJQ3WHktAS

      If you think you've found a bug, please submit an issue: https://github.com/panfactum/stack/issues
    `)
  }

  /**
   * Displays the Panfactum ASCII art logo
   */
  public showLogo() {
    this.writeRaw(
      `
          ██████╗  █████╗ ███╗   ██╗███████╗ █████╗  ██████╗████████╗██╗   ██╗███╗   ███╗
          ██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔══██╗██╔════╝╚══██╔══╝██║   ██║████╗ ████║
          ██████╔╝███████║██╔██╗ ██║█████╗  ███████║██║        ██║   ██║   ██║██╔████╔██║
          ██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██╔══██║██║        ██║   ██║   ██║██║╚██╔╝██║
          ██║     ██║  ██║██║ ╚████║██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║ ╚═╝ ██║
          ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝
      `,
    );
  }
}