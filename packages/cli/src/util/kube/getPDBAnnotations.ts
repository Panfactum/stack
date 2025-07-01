// This file provides utilities for retrieving PodDisruptionBudget annotations from Kubernetes
// It uses kubectl to fetch and parse PDB metadata

import { z } from 'zod';
import { CLIError } from '@/util/error/error';
import { execute } from '@/util/subprocess/execute';
import { parseJson } from '@/util/zod/parseJson';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Schema for validating Kubernetes annotations
 * 
 * @remarks
 * Annotations in Kubernetes are key-value pairs where both the key
 * and value are strings. This schema validates that structure.
 */
const annotationsSchema = z.record(z.string())
  .describe("Kubernetes annotations as key-value string pairs");

/**
 * Input parameters for getting PDB annotations
 */
interface IGetPDBAnnotationsInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Kubernetes namespace containing the PDB */
  namespace: string;
  /** Name of the PodDisruptionBudget */
  pdbName: string;
}

/**
 * Retrieves annotations from a PodDisruptionBudget resource
 * 
 * @remarks
 * This function fetches the annotations metadata from a PodDisruptionBudget
 * (PDB) in Kubernetes. Annotations are key-value pairs that can store
 * arbitrary metadata about the resource. This is commonly used in Panfactum
 * to track:
 * - Deployment timestamps
 * - Version information
 * - Management metadata
 * - Custom configuration flags
 * 
 * The function uses kubectl with JSONPath to extract just the annotations
 * field, avoiding the need to parse the entire PDB resource.
 * 
 * @param input - Configuration for retrieving PDB annotations
 * @returns Object containing all annotations as key-value pairs
 * 
 * @example
 * ```typescript
 * const annotations = await getPDBAnnotations({
 *   context,
 *   namespace: 'production',
 *   pdbName: 'api-server-pdb'
 * });
 * 
 * console.log(annotations['panfactum.com/version']);
 * // Output: "v1.2.3"
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when the PDB doesn't exist or kubectl command fails
 * 
 * @throws {@link PanfactumZodError}
 * Throws when the annotations cannot be parsed as valid JSON
 * 
 * @see {@link execute} - For running kubectl commands
 * @see {@link parseJson} - For JSON parsing with validation
 */
export async function getPDBAnnotations(input: IGetPDBAnnotationsInput): Promise<Record<string, string>> {
  const { context, namespace, pdbName } = input;
  
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