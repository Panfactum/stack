// This file provides a custom Inquirer confirm prompt that supports inline
// validation, matching the UX of @inquirer/input. The native @inquirer/confirm
// does not support a validate callback.

import { createPrompt, useState, useKeypress, isEnterKey, isTabKey, usePrefix, makeTheme, type Theme } from "@inquirer/core";
import type { PartialDeep } from "@inquirer/type";

/**
 * Configuration for the confirm prompt with inline validation support
 */
export interface IConfirmWithValidateConfig {
  /** The question to display */
  message: string;
  /** Default answer when the user presses Enter without typing */
  default?: boolean;
  /**
   * Validation function called with the user's boolean answer.
   * Return `true` to accept, a string to show as an inline error and re-prompt,
   * or `false` to silently re-prompt.
   */
  validate?: (value: boolean) => boolean | string | Promise<string | boolean>;
  /** Inquirer theme overrides */
  theme?: PartialDeep<Theme>;
}

function parseBooleanInput(value: string, defaultValue?: boolean): boolean {
  if (/^(y|yes)/i.test(value)) return true;
  if (/^(n|no)/i.test(value)) return false;
  return defaultValue !== false;
}

/**
 * A yes/no confirm prompt that supports inline validation.
 *
 * @remarks
 * Behaves identically to `@inquirer/confirm` but accepts an optional
 * `validate` callback. When validation fails the error message is rendered
 * inline below the prompt (same UX as `@inquirer/input`) and the prompt
 * stays active until the user provides a valid answer.
 *
 * @example
 * ```typescript
 * const confirmed = await confirmWithValidate({
 *   message: "Have you completed the setup?",
 *   validate: async (value) => {
 *     if (!value) return true;
 *     const ready = await checkSetupComplete();
 *     return ready || "Setup is not complete yet. Please try again.";
 *   },
 * });
 * ```
 */
export const confirmWithValidate = createPrompt<boolean, IConfirmWithValidateConfig>(
  (config, done) => {
    const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
    const [value, setValue] = useState("");
    const [errorMsg, setError] = useState<string | undefined>(undefined);
    const theme = makeTheme(config.theme);
    const prefix = usePrefix({ status, theme });

    useKeypress(async (key, rl) => {
      if (status !== "idle") return;

      if (isEnterKey(key)) {
        const answer = parseBooleanInput(value, config.default);

        if (config.validate) {
          setStatus("loading");
          const isValid = await config.validate(answer);
          if (isValid !== true) {
            rl.clearLine(0);
            setValue("");
            setError(typeof isValid === "string" ? isValid : "Invalid answer");
            setStatus("idle");
            return;
          }
        }

        setValue(answer ? "Yes" : "No");
        setStatus("done");
        done(answer);
      } else if (isTabKey(key)) {
        const toggled = !parseBooleanInput(value, config.default);
        const str = toggled ? "Yes" : "No";
        rl.clearLine(0);
        rl.write(str);
        setValue(str);
        setError(undefined);
      } else {
        setValue(rl.line);
        setError(undefined);
      }
    });

    let formattedValue = value;
    let defaultStr = "";
    if (status === "done") {
      formattedValue = theme.style.answer(value);
    } else {
      defaultStr = ` ${theme.style.defaultAnswer(config.default === false ? "y/N" : "Y/n")}`;
    }

    const message = theme.style.message(config.message, status);
    const error = errorMsg ? theme.style.error(errorMsg) : "";

    return [`${prefix} ${message}${defaultStr} ${formattedValue}`, error];
  }
);
