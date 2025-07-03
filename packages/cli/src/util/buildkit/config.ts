// This file provides utilities for reading and validating BuildKit configuration
// It loads the buildkit.json file containing registry and cluster settings

import { join } from 'path'
import { z } from 'zod'
import { CLIError } from '@/util/error/error'
import { readJSONFile } from '@/util/json/readJSONFile'
import type { IBuildKitConfig } from './constants.js'
import type { PanfactumContext } from '@/util/context/context.js'

/**
 * Zod schema for validating BuildKit configuration files
 */
const buildKitConfigSchema = z.object({
  /** Container registry URL for BuildKit images */
  registry: z.string().describe('Container registry URL for BuildKit images'),
  /** S3 bucket name for BuildKit cache storage */
  cache_bucket: z.string().describe('S3 bucket name for BuildKit cache storage'),
  /** AWS region where the cache bucket is located */
  cache_bucket_region: z.string().describe('AWS region where the cache bucket is located'),
  /** Kubernetes cluster name where BuildKit is deployed */
  cluster: z.string().describe('Kubernetes cluster name where BuildKit is deployed'),
  /** SSH bastion host for secure access to BuildKit */
  bastion: z.string().describe('SSH bastion host for secure access to BuildKit')
}).describe('BuildKit configuration schema for container image building')

/**
 * Input parameters for retrieving BuildKit configuration
 */
interface IGetBuildKitConfigInput {
  /** Panfactum context for configuration and logging */
  context: PanfactumContext;
}

/**
 * Retrieves and validates BuildKit configuration from the buildkit.json file
 * 
 * @remarks
 * This function reads the BuildKit configuration file that contains essential
 * settings for container image building infrastructure. The configuration
 * includes:
 * 
 * - **Registry Settings**: Container registry URL for storing built images
 * - **Cache Configuration**: S3 bucket details for build cache storage
 * - **Cluster Information**: Kubernetes cluster where BuildKit pods run
 * - **Network Access**: SSH bastion host for secure connectivity
 * 
 * The configuration file is expected at:
 * `{buildkit_dir}/buildkit.json`
 * 
 * This configuration is typically created during BuildKit setup and is
 * required for:
 * - Building container images
 * - Pushing images to registries
 * - Managing build caches
 * - Establishing secure connections
 * 
 * @param input - Configuration parameters
 * @returns Validated BuildKit configuration object
 * 
 * @example
 * ```typescript
 * const config = await getBuildKitConfig({ context });
 * console.log(`Registry: ${config.registry}`);
 * console.log(`Cache bucket: ${config.cache_bucket}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when the configuration file is missing
 * 
 * @throws {@link CLIError}
 * Throws when the configuration file is empty
 * 
 * @throws {@link PanfactumZodError}
 * Throws when the configuration doesn't match the expected schema
 * 
 * @see {@link readJSONFile} - For JSON file reading and validation
 * @see {@link IBuildKitConfig} - The configuration type definition
 */
export async function getBuildKitConfig(input: IGetBuildKitConfigInput): Promise<IBuildKitConfig> {
  const { context } = input;
  const devshellConfig = context.devshellConfig
  const buildkitDir = devshellConfig.buildkit_dir
  const configPath = join(buildkitDir, 'buildkit.json')

  const config = await readJSONFile({
    context,
    filePath: configPath,
    validationSchema: buildKitConfigSchema,
    throwOnMissing: true,
    throwOnEmpty: true
  })

  // This should never happen with throwOnMissing and throwOnEmpty set to true
  if (!config) {
    throw new CLIError('Unexpected null config from readJSONFile')
  }

  return config
}