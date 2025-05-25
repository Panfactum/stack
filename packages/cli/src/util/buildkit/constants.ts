export const BUILDKIT_STATEFULSET_NAME_PREFIX = 'buildkit-'
export const BUILDKIT_LAST_BUILD_ANNOTATION_KEY = 'panfactum.com/last-build'
export const BUILDKIT_NAMESPACE = 'buildkit'
export const BUILDKIT_PORT = 1234

export type Architecture = 'amd64' | 'arm64'
export const architectures: Architecture[] = ['amd64', 'arm64']

export interface BuildKitConfig {
  registry: string
  cache_bucket: string
  cache_bucket_region: string
  cluster: string
  bastion: string
}