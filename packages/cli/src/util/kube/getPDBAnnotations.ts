import { z } from 'zod';
import { execute } from '@/util/subprocess/execute';
import { parseJson } from '@/util/zod/parseJson';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Get annotations for a PodDisruptionBudget
 * @param params Configuration for getting PDB annotations
 * @returns Object containing all annotations
 */
export async function getPDBAnnotations(params: {
  context: PanfactumContext;
  namespace: string;
  pdbName: string;
}): Promise<Record<string, string>> {
  const { context, namespace, pdbName } = params;
  
  const result = await execute({
    command: [
      'kubectl', 'get', pdbName,
      '-n', namespace,
      '-o', 'jsonpath={.metadata.annotations}',
    ],
    context,
    workingDirectory: process.cwd(),
  });
  
  const annotationsSchema = z.record(z.string());
  return parseJson(annotationsSchema, result.stdout || '{}');
}