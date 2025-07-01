// This file defines constants and types for BuildKit integration
// It includes Kubernetes resource names, annotations, and configuration schemas

import { z } from 'zod'

/** Prefix for BuildKit StatefulSet names in Kubernetes */
export const BUILDKIT_STATEFULSET_NAME_PREFIX = 'buildkit-'

/** Kubernetes annotation key for tracking last build time */
export const BUILDKIT_LAST_BUILD_ANNOTATION_KEY = 'panfactum.com/last-build'

/** Kubernetes namespace where BuildKit pods are deployed */
export const BUILDKIT_NAMESPACE = 'buildkit'

/** Default port for BuildKit daemon */
export const BUILDKIT_PORT = 1234

/**
 * Zod schema for validating supported CPU architectures
 * @remarks Supports amd64 (x86_64) and arm64 (aarch64) architectures
 */
export const architectureSchema = z.enum(['amd64', 'arm64']).describe('Supported CPU architectures for BuildKit')

/** Supported CPU architecture types */
export type Architecture = z.infer<typeof architectureSchema>

/** Array of all supported architectures */
export const architectures = architectureSchema.options

/**
 * BuildKit configuration structure
 * @remarks Contains all necessary settings for BuildKit deployment and usage
 */
/**
 * BuildKit configuration structure
 * 
 * @remarks
 * Contains all necessary settings for BuildKit deployment and usage.
 * This configuration is used throughout the CLI to manage BuildKit
 * instances and handle container image builds.
 */
export interface IBuildKitConfig {
  /** Container registry URL for storing built images */
  registry: string
  /** S3 bucket name for caching build layers */
  cache_bucket: string
  /** AWS region where the cache bucket is located */
  cache_bucket_region: string
  /** Kubernetes cluster name where BuildKit is deployed */
  cluster: string
  /** SSH bastion host for secure cluster access */
  bastion: string
}