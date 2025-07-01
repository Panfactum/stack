import { z } from "zod";
import { readYAMLFile } from "@/util/yaml/readYAMLFile.ts";
import type { PanfactumContext } from "@/util/context/context.ts";

// Schema for the raw kubeconfig context structure
const RAW_KUBECONFIG_CONTEXT_SCHEMA = z.object({
  name: z.string(),
  context: z.object({
    cluster: z.string(),
    user: z.string(),
    namespace: z.string().optional()
  })
});

// Minimal schema for kubeconfig - only validating what we need
const KUBECONFIG_SCHEMA = z.object({
  contexts: z.array(RAW_KUBECONFIG_CONTEXT_SCHEMA).optional().default([])
}).passthrough(); // Allow other fields we don't care about

// Flattened context type
export type KubeContext = {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
};

export async function getKubeContextsFromConfig(context: PanfactumContext): Promise<KubeContext[]> {
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