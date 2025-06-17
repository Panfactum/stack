/**
 * Get kubectl context arguments for command execution
 * @param kubectlContext - Optional kubectl context name
 * @returns Array of kubectl arguments for context, or empty array if no context
 */
export function getKubectlContextArgs(kubectlContext?: string): string[] {
  return kubectlContext ? ['--context', kubectlContext] : []
}