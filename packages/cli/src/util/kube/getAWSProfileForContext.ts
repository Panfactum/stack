// This file provides utilities for extracting AWS profile information from Kubernetes configurations
// It parses kubectl config files to find the AWS profile associated with a specific context

import { join } from "node:path";
import { z } from "zod";
import { CLIError } from '@/util/error/error';
import { readYAMLFile } from '@/util/yaml/readYAMLFile';
import type { PanfactumContext } from '@/util/context/context';

/**
 * Schema for parsing kubectl config files
 * 
 * @remarks
 * This schema validates only the parts of the kubectl config that we need
 * to extract AWS profile information. It focuses on the contexts and users
 * sections, specifically looking for exec configurations with AWS_PROFILE
 * environment variables.
 * 
 * The schema uses .passthrough() to allow additional fields that we don't
 * care about, making it resilient to kubectl config format variations.
 */
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
}).passthrough()
  .describe("Partial kubectl config schema for AWS profile extraction");

/**
 * Input parameters for getting AWS profile from Kubernetes context
 */
interface IGetAWSProfileForContextInput {
  /** Panfactum context for configuration access */
  context: PanfactumContext;
  /** Kubernetes context name to look up */
  kubeContext: string;
}

/**
 * Extracts the AWS profile name associated with a Kubernetes context
 * 
 * @remarks
 * This function parses the kubectl configuration file to find which AWS
 * profile is used for authenticating to a specific Kubernetes cluster.
 * This is essential for Panfactum's EKS integration, where each cluster
 * context is associated with an AWS profile for authentication.
 * 
 * The function:
 * 1. Reads the kubectl config file from the configured kube directory
 * 2. Finds the specified context in the contexts list
 * 3. Looks up the associated user configuration
 * 4. Extracts the AWS_PROFILE from the exec environment variables
 * 
 * This AWS profile information is typically used to:
 * - Generate EKS authentication tokens
 * - Access AWS resources associated with the cluster
 * - Perform cluster operations that require AWS credentials
 * 
 * @param input - Parameters including context and Kubernetes context name
 * @returns The AWS profile name associated with the context
 * 
 * @example
 * ```typescript
 * const awsProfile = await getAWSProfileForContext({
 *   context,
 *   kubeContext: 'production-us-east-1'
 * });
 * console.log(`Use AWS profile: ${awsProfile}`);
 * // Output: "Use AWS profile: prod-admin"
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to read the kubectl config file
 * 
 * @throws {@link CLIError}
 * Throws when the specified context is not found in the config
 * 
 * @throws {@link CLIError}
 * Throws when the user associated with the context is not found
 * 
 * @throws {@link CLIError}
 * Throws when no exec configuration exists for the user
 * 
 * @throws {@link CLIError}
 * Throws when AWS_PROFILE is not set in the exec environment
 * 
 * @see {@link readYAMLFile} - For reading and parsing the kubectl config
 * @see {@link KUBE_CONFIG_SCHEMA} - Schema for config validation
 */
export async function getAWSProfileForContext(
  input: IGetAWSProfileForContextInput
): Promise<string> {
  const { context, kubeContext } = input;
  const kubeConfigPath = join(context.repoVariables.kube_dir, "config");
  
  const kubeConfig = await readYAMLFile({
    context,
    filePath: kubeConfigPath,
    validationSchema: KUBE_CONFIG_SCHEMA,
    throwOnMissing: true
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to read kube config from ${kubeConfigPath}`,
      error
    );
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
}