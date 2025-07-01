// This file provides utilities for constructing kubectl command-line arguments
// It helps build context-specific arguments for kubectl commands

/**
 * Constructs kubectl command-line arguments for specifying a context
 * 
 * @remarks
 * This utility function generates the appropriate command-line arguments
 * for kubectl to use a specific context. When a context is provided,
 * it returns ['--context', contextName]. When no context is provided,
 * it returns an empty array, allowing kubectl to use the current context.
 * 
 * This function is essential for:
 * - Running kubectl commands against specific clusters
 * - Switching between multiple Kubernetes environments
 * - Ensuring commands target the correct cluster
 * 
 * @param kubectlContext - Optional kubectl context name to use
 * @returns Array of command-line arguments for kubectl
 * 
 * @example
 * ```typescript
 * // With context
 * const args = getKubectlContextArgs('production');
 * // Returns: ['--context', 'production']
 * 
 * // Execute kubectl with context
 * const fullCommand = ['kubectl', 'get', 'pods', ...args];
 * // Results in: kubectl get pods --context production
 * ```
 * 
 * @example
 * ```typescript
 * // Without context (use current context)
 * const args = getKubectlContextArgs();
 * // Returns: []
 * 
 * // Execute kubectl with current context
 * const fullCommand = ['kubectl', 'get', 'pods', ...args];
 * // Results in: kubectl get pods
 * ```
 */
export function getKubectlContextArgs(kubectlContext?: string): string[] {
  return kubectlContext ? ['--context', kubectlContext] : []
}