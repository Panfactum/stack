import { z } from 'zod'

export const BUILDKIT_STATEFULSET_NAME_PREFIX = 'buildkit-'
export const BUILDKIT_LAST_BUILD_ANNOTATION_KEY = 'panfactum.com/last-build'
export const BUILDKIT_NAMESPACE = 'buildkit'
export const BUILDKIT_PORT = 1234

// Zod schema for architecture validation
export const architectureSchema = z.enum(['amd64', 'arm64'])
export type Architecture = z.infer<typeof architectureSchema>
export const architectures = architectureSchema.options

export interface BuildKitConfig {
  registry: string
  cache_bucket: string
  cache_bucket_region: string
  cluster: string
  bastion: string
}