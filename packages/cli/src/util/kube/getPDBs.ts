// This file provides utilities for retrieving PodDisruptionBudgets from Kubernetes
// It filters PDBs based on Panfactum-specific labels

import { execute } from '@/util/subprocess/execute';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Input parameters for getting PDBs by window ID
 */
interface IGetPDBsByWindowIdInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Kubernetes namespace to search in */
  namespace: string;
  /** Voluntary disruption window ID to filter by */
  windowId: string;
}

/**
 * Retrieves PodDisruptionBudgets filtered by voluntary disruption window ID
 * 
 * @remarks
 * This function finds all PodDisruptionBudgets (PDBs) in a namespace that
 * are labeled with a specific voluntary disruption window ID. This is part
 * of Panfactum's controlled disruption system, where PDBs can be temporarily
 * adjusted during maintenance windows.
 * 
 * The function searches for PDBs with the label:
 * `panfactum.com/voluntary-disruption-window-id=<windowId>`
 * 
 * This allows operators to:
 * - Group PDBs that should be modified together
 * - Apply temporary disruption policies during maintenance
 * - Track which PDBs are part of a disruption window
 * 
 * @param input - Configuration for retrieving PDBs
 * @returns Array of PDB resource names in kubectl format
 * 
 * @example
 * ```typescript
 * const pdbs = await getPDBsByWindowId({
 *   context,
 *   namespace: 'production',
 *   windowId: 'maint-2024-01-15'
 * });
 * 
 * console.log(pdbs);
 * // Output: [
 * //   'poddisruptionbudget.policy/api-server',
 * //   'poddisruptionbudget.policy/worker-nodes'
 * // ]
 * ```
 * 
 * @see {@link execute} - For running kubectl commands
 * @see {@link pdbConstants} - For PDB-related constants and labels
 */
export async function getPDBsByWindowId(input: IGetPDBsByWindowIdInput): Promise<string[]> {
  const { context, namespace, windowId } = input;
  
  const result = await execute({
    command: [
      'kubectl', 'get', 'pdb',
      '-n', namespace,
      '-l', `panfactum.com/voluntary-disruption-window-id=${windowId}`,
      '--ignore-not-found',
      '-o', 'name',
    ],
    context,
    workingDirectory: process.cwd(),
  });
  
  return result.stdout
    .trim()
    .split('\n')
    .filter(line => line.length > 0);
}