/**
 * Options for generating a progress string
 */
interface ProgressOptions {
  /** Number of completed steps */
  completedSteps: number;
  /** Total number of steps */
  totalSteps: number;
}

/**
 * Generates a formatted progress string with a visual bar and percentage
 *
 * @param options Object containing completedSteps and totalSteps
 * @returns Formatted progress string with visual bar and percentage
 *
 * @example
 * // Returns "[======    ] 75% complete\n\n"
 * generateProgressString({ completedSteps: 3, totalSteps: 4 });
 */
export function generateProgressString({
  completedSteps,
  totalSteps,
}: ProgressOptions): string {
  // Ensure completedSteps doesn't exceed totalSteps
  const validCompletedSteps = Math.max(0, Math.min(completedSteps, totalSteps));
  
  // Calculate the percentage (rounded to whole number)
  const percentage =
    totalSteps === 0 ? 0 : Math.round((validCompletedSteps / totalSteps) * 100);

  // Generate the progress bar parts
  const completedPart = "=".repeat(validCompletedSteps * 2);
  const remainingPart = " ".repeat((totalSteps - validCompletedSteps) * 2);

  // Combine parts into the final string
  return `[${completedPart}${remainingPart}] ${percentage}% complete\n\n`;
}
