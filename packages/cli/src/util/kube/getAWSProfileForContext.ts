// This file provides utilities for extracting AWS profile information from Kubernetes configurations
// It parses kubectl config files to find the AWS profile associated with a specific context

import { join } from "node:path";
import { CLIError } from '@/util/error/error';
import { KUBE_CONFIG_SCHEMA } from '@/util/kube/schemas';
import { readYAMLFile } from '@/util/yaml/readYAMLFile';
import type { PanfactumContext } from '@/util/context/context';

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
 * 4. Extracts the AWS profile from either:
 *    - The AWS_PROFILE environment variable in exec configuration
 *    - The --profile argument in exec args
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
 * Throws when AWS profile is not found in either environment variables or exec arguments
 * 
 * @see {@link readYAMLFile} - For reading and parsing the kubectl config
 * @see {@link KUBE_CONFIG_SCHEMA} - Schema for config validation from schemas.ts
 */
export async function getAWSProfileForContext(
  input: IGetAWSProfileForContextInput
): Promise<string> {
  const { context, kubeContext } = input;
  const kubeConfigPath = join(context.devshellConfig.kube_dir, "config");

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

  // Extract AWS profile from exec config
  const execConfig = userConfig.user.exec;
  if (!execConfig) {
    throw new CLIError(`No exec configuration found for user '${userName}' in context '${kubeContext}'`);
  }

  // First, check if AWS profile is set via environment variable
  if (execConfig.env && Array.isArray(execConfig.env)) {
    const awsProfileEnv = execConfig.env.find(e => e.name === 'AWS_PROFILE');
    if (awsProfileEnv) {
      return awsProfileEnv.value;
    }
  }

  // Second, check if AWS profile is set via --profile argument
  if (execConfig.args && Array.isArray(execConfig.args)) {
    // Check for --profile as separate argument
    const profileArgIndex = execConfig.args.findIndex(arg => arg === '--profile');
    if (profileArgIndex !== -1 && profileArgIndex < execConfig.args.length - 1) {
      const profileValue = execConfig.args[profileArgIndex + 1];
      if (profileValue) {
        return profileValue;
      }
    }

    // Check for --profile=value format
    const profileArg = execConfig.args.find(arg => arg.startsWith('--profile='));
    if (profileArg) {
      return profileArg.substring('--profile='.length);
    }
  }

  throw new CLIError(`No AWS profile found in exec configuration for context '${kubeContext}'. AWS profile must be set either via AWS_PROFILE environment variable or --profile argument.`);
}