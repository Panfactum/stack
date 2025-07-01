// This file provides utilities for extracting Kubernetes contexts from kubectl config files
// It parses the config to provide a simplified view of available cluster contexts

import { z } from "zod";
import { readYAMLFile } from "@/util/yaml/readYAMLFile.ts";
import type { PanfactumContext } from "@/util/context/context.ts";

/**
 * Schema for individual Kubernetes context entries in kubectl config
 * 
 * @remarks
 * Validates the structure of context entries as they appear in the
 * kubectl configuration file, with nested context details.
 */
const RAW_KUBECONFIG_CONTEXT_SCHEMA = z.object({
  name: z.string(),
  context: z.object({
    cluster: z.string(),
    user: z.string(),
    namespace: z.string().optional()
  })
}).describe("Raw kubectl context entry");

/**
 * Schema for kubectl configuration file
 * 
 * @remarks
 * This minimal schema only validates the contexts section of the kubectl
 * config file. It uses .passthrough() to allow other standard kubectl
 * config fields that we don't need to parse.
 */
const KUBECONFIG_SCHEMA = z.object({
  contexts: z.array(RAW_KUBECONFIG_CONTEXT_SCHEMA).optional().default([])
}).passthrough() // Allow other fields we don't care about
  .describe("Minimal kubectl config schema for context extraction");

/**
 * Flattened Kubernetes context information
 * 
 * @remarks
 * A simplified representation of a kubectl context with the nested
 * structure flattened for easier access to common properties.
 */
export interface IKubeContext {
  /** Context name as it appears in kubectl commands */
  name: string;
  /** Cluster name this context connects to */
  cluster: string;
  /** User/authentication configuration name */
  user: string;
  /** Default namespace for this context (optional) */
  namespace?: string;
}

/**
 * Retrieves all Kubernetes contexts from the kubectl configuration file
 * 
 * @remarks
 * This function reads and parses the kubectl config file to extract all
 * available Kubernetes contexts. It provides a simplified, flattened view
 * of the contexts, making it easy to:
 * - List available clusters
 * - Find contexts by name
 * - Determine authentication requirements
 * - Get default namespaces
 * 
 * The function gracefully handles missing or empty config files by
 * returning an empty array, allowing the application to continue
 * even when kubectl hasn't been configured yet.
 * 
 * @param context - Panfactum context for configuration access
 * @returns Array of flattened Kubernetes context objects
 * 
 * @example
 * ```typescript
 * const contexts = await getKubeContextsFromConfig(context);
 * 
 * // Find a specific context
 * const prodContext = contexts.find(ctx => ctx.name === 'production');
 * if (prodContext) {
 *   console.log(`Production cluster: ${prodContext.cluster}`);
 *   console.log(`Default namespace: ${prodContext.namespace || 'default'}`);
 * }
 * 
 * // List all available contexts
 * contexts.forEach(ctx => {
 *   console.log(`Context: ${ctx.name} -> ${ctx.cluster}`);
 * });
 * ```
 * 
 * @see {@link readYAMLFile} - For reading and parsing the kubectl config
 * @see {@link IKubeContext} - The flattened context structure
 */
export async function getKubeContextsFromConfig(context: PanfactumContext): Promise<IKubeContext[]> {
  const kubeConfigPath = context.repoVariables.kube_dir + "/config";

  const config = await readYAMLFile({
    context,
    filePath: kubeConfigPath,
    validationSchema: KUBECONFIG_SCHEMA,
    throwOnMissing: false,
    throwOnEmpty: false
  });

  if (!config) {
    return [];
  }

  // Flatten the contexts structure
  return config.contexts.map(ctx => ({
    name: ctx.name,
    cluster: ctx.context.cluster,
    user: ctx.context.user,
    namespace: ctx.context.namespace
  }));
}