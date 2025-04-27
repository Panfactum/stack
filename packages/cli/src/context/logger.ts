import { Writable } from "node:stream";
import { input, confirm, search, checkbox, select, password } from "@inquirer/prompts";
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import pc from "picocolors";
import { terminalColumns } from "terminal-columns";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

// This allows use to use multiline JS strings
// with proper indentation and formatting when primpted to the user.
// This reduces having to put \n characters all over the codebase
// and makes things much easier to edit and read
function dedent(text: string) {
  const lines = text.split(`\n`);
  const nonEmptyLines = lines.filter(line => line.match(/\S/));

  const indent = nonEmptyLines.length > 0 ? nonEmptyLines.reduce((minLength, line) => Math.min(minLength, line.length - line.trimStart().length), Number.MAX_VALUE) : 0;

  return lines
    .map(line => line.slice(indent).trimEnd())
    .join(`\n`)
    .replace(/^\n+|\n+$/g, ``)   // Remove surrounding newlines, since they got added for JS formatting
    .replace(/\n(\n)?\n*/g, (_, s: string) => s ? s : ` `) // Single newlines are removed; larger than that are collapsed into one
    .split(/\n/).map(paragraph => {
      return paragraph.match(/(.{1,80})(?: |$)/g)!.join(`\n`);
    }).join(`\n\n`);
}

type ColorStyle = "default" | "warning" | "important" | "question" | "error" | "success" | "subtle"

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

  ///////////////////////////////////////////////////////
  // Debug utility
  //
  // This captures debug 'events' which are essentially
  // any marker that we want to capture in crash logs
  // but don't want to show to the user directly in the
  // interactive prompts.
  //////////////////////////////////////////////////////

  public debug(action: string, _?: { [k: string]: unknown }) {
    if (this.debugEnabled) {
      this.stream.write(action)
    }
  }

  ///////////////////////////////////////////////////////
  // Colors
  //////////////////////////////////////////////////////

  // An 'identifier' is a specific named object (e.g., environment, account, domain, etc.)
  // that we want to have highlighted in all user-facing log messsages.
  // This utility reduces the amount of boilerplate that we have to add
  // in our logging
  public addIdentifier(str: string) {
    this.identifiers.push(str)
  }

  public removeIdentifier(str: string) {
    this.identifiers = this.identifiers.filter(identifier => identifier !== str)
  }

  // This provides some pretty advanced coloring functionality
  //   - Applies our standard color styles to the text
  //   - Applies style-aware highlights and downlights
  //   - Automatically adds highlights to our important strings (e.g., identifiers)
  //   - Resolves ambiguities that can often occur
  //      - Conflicting highlights
  //      - Highlight and primary style conflicts
  //      - Conflicts between our automatic highlights and function parameter highlights

  public applyColors(str: string, config?: {
    style?: ColorStyle
    bold?: boolean,
    highlights?: string[],
    lowlights?: string[],
    badlights?: string[]
  }) {
    const {
      style = "default",
      bold,
      highlights = [],
      lowlights = [],
      badlights = [],
    } = config || {}

    let resultStr = this.getColorFn(style)(str)
    if (bold) {
      resultStr = pc.bold(resultStr)
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
        while ((pos = str.indexOf(phrase, pos)) !== -1) {
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

        for (const { start, end, style } of mergedPositions) {
          // Add text before this highlight with the base style
          if (start > lastEnd) {
            result += this.getColorFn(style)(str.substring(lastEnd, start));
          }

          // Add the highlighted text
          result += this.getColorFn(style)(str.substring(start, end));
          lastEnd = end;
        }

        // Add any remaining text with the base style
        if (lastEnd < str.length) {
          result += this.getColorFn(style)(str.substring(lastEnd));
        }

        resultStr = result;
      }

      // Return early since we've processed all highlights
      return bold ? pc.bold(resultStr) : resultStr;
    }

    return resultStr;
  }

  public getColorFn(style: ColorStyle) {

    switch (style) {
      case "error": {
        return pc.red
      }
      case "warning": {
        return pc.yellow
      }
      case "important": {
        return pc.blue
      }
      case "success": {
        return pc.greenBright
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

  ///////////////////////////////////////////////////////
  // Logging utilities
  //
  // These function print user-facing logs with a few extra
  // features:
  //
  //    - Automatic styling
  //    - Automatic line wraps
  //    - Iconography
  //////////////////////////////////////////////////////

  public info(str: string) {
    this.stream.write(terminalColumns([[
      this.applyColors("🛈", { style: "important" }),
      this.applyColors(dedent(str), { style: "default" })
    ]], [4, 80]))
    this.stream.write("\n\n")
  }

  public warn(str: string) {
    this.stream.write(terminalColumns([[
      this.applyColors("⚠", { style: "warning" }),
      this.applyColors(dedent(str), { style: "default" })
    ]], [4, 80]))
    this.stream.write("\n\n")
  }

  public success(str: string) {
    this.stream.write(terminalColumns([[
      this.applyColors("✓", { style: "success" }),
      this.applyColors(dedent(str), { style: "default" })
    ]], [4, 80]))
    this.stream.write("\n\n")
  }

  public error(str: string) {
    this.stream.write(terminalColumns([[
      this.applyColors(dedent(str), { style: "error" })
    ]], [80]))
    this.stream.write("\n\n")
  }

  public write(str: string) {
    this.stream.write(terminalColumns([[
      this.applyColors(dedent(str), { style: "default" })
    ]], [80]))
    this.stream.write("\n\n")
  }


  //////////////////////////////////////////////////////
  // Inquirer Prompt Wrappers
  //
  // A few enhancements over the default prompts:
  //
  //   - Color styling is automatically applied
  //   - Line spacing is automatically added
  //   - Listr integration is provided
  //   - Debugging automatically added
  //   - Added the ability to provide explainer text prior to the
  //     the question line (and provides Listr integration)
  ///////////////////////////////////////////////////////

  public input = (config: {
    message: string;
    default?: string;
    required?: boolean;
    transformer?: (value: string, { isFinal }: { isFinal: boolean; }) => string;
    validate?: (value: string) => boolean | string | Promise<string | boolean>;
    explainer?: string;
    task?: PanfactumTaskWrapper
  }) => {
    const { validate, message, explainer, task } = config;

    if (explainer) {
      if (task) {
        task.output = this.applyColors(dedent(explainer), { style: "warning" })
      } else {
        this.write(explainer)
      }
    }

    const wrappedConfig = {
      required: true,
      ...config,
      message: this.applyColors(message, { style: "question" }),
      validate: validate ? async (val: string) => {
        const retVal = await validate(val)
        if (typeof retVal === "string") {
          return this.applyColors(retVal, { style: "error" })
        } else {
          return retVal
        }
      } : undefined
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(input, wrappedConfig) :
      input(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  public password = (config: {
    message: string;
    default?: string;
    required?: boolean;
    mask?: boolean | string;
    validate?: (value: string) => boolean | string | Promise<string | boolean>;
    explainer?: string;
    task?: PanfactumTaskWrapper
  }) => {
    const { validate, message, explainer, task } = config;

    if (explainer) {
      if (task) {
        task.output = this.applyColors(dedent(explainer), { style: "warning" })
      } else {
        this.write(explainer)
      }
    }

    const wrappedConfig = {
      required: true,
      mask: true,
      ...config,
      message: this.applyColors(message, { style: "question" }),
      validate: validate ? async (val: string) => {
        const retVal = await validate(val)
        if (typeof retVal === "string") {
          return this.applyColors(retVal, { style: "error" })
        } else {
          return retVal
        }
      } : undefined
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(password, wrappedConfig) :
      password(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  public select = <T>(config: {
    message: string;
    choices: Array<{ name: string; value: T; disabled?: boolean | string }>;
    default?: T;
    explainer?: string;
    task?: PanfactumTaskWrapper
  }) => {
    const { message, explainer, task } = config;

    if (explainer) {
      if (task) {
        task.output = this.applyColors(dedent(explainer), { style: "warning" })
      } else {
        this.write(explainer)
      }
    }

    const wrappedConfig = {
      ...config,
      message: this.applyColors(message, { style: "question" }),
      theme: {
        helpMode: "never" as const
      },
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(select<T>, wrappedConfig) :
      select<T>(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  public checkbox = <T>(config: {
    message: string;
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>;
    validate?: (choices: readonly { value: T; checked?: boolean }[]) => boolean | string | Promise<string | boolean>;
    instructions?: boolean | string;
    explainer?: string;
    task?: PanfactumTaskWrapper
  }) => {
    const { validate, message, explainer, task } = config;

    if (explainer) {
      if (task) {
        task.output = this.applyColors(dedent(explainer), { style: "warning" })
      } else {
        this.write(explainer)
      }
    }

    const wrappedConfig = {
      instructions: false,
      ...config,
      message: this.applyColors(message, { style: "question" }),
      validate: validate ? async (val: readonly { value: T; checked?: boolean }[]) => {
        const retVal = await validate(val)
        if (typeof retVal === "string") {
          return this.applyColors(retVal, { style: "error" })
        } else {
          return retVal
        }
      } : undefined,
      theme: {
        helpMode: "never" as const
      },
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(checkbox<T>, wrappedConfig) :
      checkbox<T>(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  public search = <T>(config: {
    message: string;
    source: (term: string | undefined) => Promise<Array<{ name: string; value: T }>> | Array<{ name: string; value: T }>;
    default?: string;
    explainer?: string;
    validate?: (value: T) => boolean | string | Promise<string | boolean>;
    task?: PanfactumTaskWrapper
  }) => {
    const { message, explainer, task, source, validate } = config;

    if (explainer) {
      if (task) {
        task.output = this.applyColors(dedent(explainer), { style: "warning" })
      } else {
        this.write(explainer)
      }
    }

    const wrappedConfig = {
      ...config,
      message: this.applyColors(message, { style: "question" }),
      source,
      validate: validate ? async (val: T) => {
        const retVal = await validate(val)
        if (typeof retVal === "string") {
          return this.applyColors(retVal, { style: "error" })
        } else {
          return retVal
        }
      } : undefined,
      theme: {
        helpMode: "never" as const
      },
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(search<T>, wrappedConfig) :
      search<T>(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }

  public confirm = (config: {
    message: string;
    default?: boolean;
    explainer?: string;
    task?: PanfactumTaskWrapper
  }) => {
    const { message, explainer, task } = config;

    if (explainer) {
      if (task) {
        task.output = this.applyColors(dedent(explainer), { style: "warning" })
      } else {
        this.write(explainer)
      }
    }

    const wrappedConfig = {
      ...config,
      message: this.applyColors(message, { style: "question" })
    }

    return task ?
      task.prompt(ListrInquirerPromptAdapter).run(confirm, wrappedConfig) :
      confirm(wrappedConfig).then((res) => { this.stream.write("\n"); return res; })
  }


  public crashMessage() {
    this.error(`
      If you need assistance, connect with us on our discord server: https://discord.gg/MJQ3WHktAS

      If you think you've found a bug, please submit an issue: https://github.com/panfactum/stack/issues
    `)
  }

  public showLogo() {
    this.write(
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