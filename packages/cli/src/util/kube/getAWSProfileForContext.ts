// Utility function to get AWS profile for a Kubernetes context by parsing kube config
import { join } from "node:path";
import { z } from "zod";
import { CLIError } from '@/util/error/error';
import { readYAMLFile } from '@/util/yaml/readYAMLFile';
import type { PanfactumContext } from '@/util/context/context';

// Schema for parsing the kube config - only the parts we need
const KUBE_CONFIG_SCHEMA = z.object({
  contexts: z.array(z.object({
    name: z.string(),
    context: z.object({
      user: z.string()
    }).passthrough()
  })).optional().default([]),
  users: z.array(z.object({
    name: z.string(),
    user: z.object({
      exec: z.object({
        env: z.array(z.object({
          name: z.string(),
          value: z.string()
        })).optional()
      }).passthrough().optional()
    }).passthrough()
  })).optional().default([])
}).passthrough();

export async function getAWSProfileForContext(
  context: PanfactumContext,
  kubeContext: string
): Promise<string> {
  const kubeConfigPath = join(context.repoVariables.kube_dir, "config");
  
  try {
    const kubeConfig = await readYAMLFile({
      context,
      filePath: kubeConfigPath,
      validationSchema: KUBE_CONFIG_SCHEMA,
      throwOnMissing: true
    });

    if (!kubeConfig) {
      throw new CLIError(`No kube config found at ${kubeConfigPath}`);
    }

    // Find the context
    const contextConfig = kubeConfig.contexts.find(ctx => ctx.name === kubeContext);
    if (!contextConfig) {
      throw new CLIError(`Context '${kubeContext}' not found in kube config.`);
    }

    // Find the user associated with this context
    const userName = contextConfig.context.user;
    const userConfig = kubeConfig.users.find(u => u.name === userName);
    if (!userConfig) {
      throw new CLIError(`User '${userName}' not found in kube config for context '${kubeContext}'`);
    }

    // Extract AWS profile from exec env
    const execConfig = userConfig.user.exec;
    if (!execConfig || !execConfig.env) {
      throw new CLIError(`No exec environment configuration found for user '${userName}' in context '${kubeContext}'`);
    }

    const awsProfileEnv = execConfig.env.find(e => e.name === 'AWS_PROFILE');
    if (!awsProfileEnv) {
      throw new CLIError(`No AWS_PROFILE environment variable found in exec configuration for context '${kubeContext}'`);
    }

    return awsProfileEnv.value;
  } catch (error) {
    throw new CLIError(
      `Failed to get AWS profile for context '${kubeContext}'`,
      { cause: error }
    );
  }
}