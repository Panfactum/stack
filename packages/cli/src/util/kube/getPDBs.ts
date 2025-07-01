import { execute } from '@/util/subprocess/execute';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Get PodDisruptionBudgets (PDBs) by window ID in a namespace
 * @param params Configuration for getting PDBs
 * @returns Array of PDB names (e.g., ['poddisruptionbudget.policy/my-pdb'])
 */
export async function getPDBsByWindowId(params: {
  context: PanfactumContext;
  namespace: string;
  windowId: string;
}): Promise<string[]> {
  const { context, namespace, windowId } = params;
  
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