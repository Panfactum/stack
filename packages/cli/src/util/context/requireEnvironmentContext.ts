// This file provides a utility function to ensure environment context is active
// It validates that the PF_ACTIVE_ENVIRONMENT variable is set before command execution

import { CLIError } from "../error/error";

/**
 * Asserts that an active environment context is present.
 *
 * @remarks
 * Checks for the PF_ACTIVE_ENVIRONMENT environment variable, which is set
 * by each environment's .envrc when the user enters an environment directory.
 * This prevents environment-scoped operations from running in the wrong context
 * or without any environment context at all.
 *
 * Environment-scoped commands (like `pf devshell sync`, `pf iac apply`) must
 * call this function to ensure they have the proper context before proceeding
 * with operations that affect specific environment infrastructure.
 *
 * @throws {@link CLIError}
 * Throws when PF_ACTIVE_ENVIRONMENT is not set, indicating no environment
 * context is active.
 *
 * @example
 * ```typescript
 * // In a command's execute() method
 * async execute() {
 *   requireEnvironmentContext();
 *   // ... rest of environment-specific logic
 * }
 * ```
 *
 * @see Environment directories in `/environments/` - Each sets PF_ACTIVE_ENVIRONMENT
 */
export function requireEnvironmentContext(): void {
  const activeEnv = process.env["PF_ACTIVE_ENVIRONMENT"];
  if (!activeEnv) {
    throw new CLIError(
      "No environment context detected. Navigate into an environment directory " +
      "(e.g., `cd environments/production`) to activate the environment devshell " +
      "before running this command."
    );
  }
}