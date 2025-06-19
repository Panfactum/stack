import { z } from 'zod';
import { CLIError } from '@/util/error/error';
import { execute } from '@/util/subprocess/execute';
import { parseJson } from '@/util/zod/parseJson';
import type { PanfactumContext } from '@/util/context/context';

const annotationsSchema = z.record(z.string());

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
  
  const { stdout } = await execute({
    command: [
      'kubectl', 'get', pdbName,
      '-n', namespace,
      '-o', 'jsonpath={.metadata.annotations}',
    ],
    context,
    workingDirectory: process.cwd(),
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to get annotations for PodDisruptionBudget '${pdbName}' in namespace '${namespace}'`,
      error
    );
  });
  
  // parseJson handles validation and throws appropriate errors
  return parseJson(annotationsSchema, stdout || '{}');
}