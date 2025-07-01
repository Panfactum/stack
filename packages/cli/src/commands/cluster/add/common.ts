import type { PanfactumContext } from "@/util/context/context";

/**
 * Configuration options for cluster installation steps
 * 
 * @remarks
 * This interface defines the common parameters passed to all cluster setup functions
 * during the installation process. Each setup step receives these options to configure
 * the infrastructure components appropriately for the target environment.
 * 
 * @example
 * ```typescript
 * const options: IInstallClusterStepOptions = {
 *   awsProfile: 'production',
 *   clusterPath: '/infrastructure/production/us-west-2/cluster',
 *   environmentPath: '/infrastructure/production',
 *   environment: 'production',
 *   kubeConfigContext: 'pf-prod-cluster',
 *   domains: {
 *     'example.com': {
 *       zone_id: 'Z123456789',
 *       record_manager_role_arn: 'arn:aws:iam::123456789:role/DNSManager'
 *     }
 *   },
 *   region: 'us-west-2',
 *   awsRegion: 'us-west-2',
 *   context: panfactumContext,
 *   slaTarget: 2
 * };
 * ```
 */
export interface IInstallClusterStepOptions {
  /** AWS profile name for authentication */
  awsProfile: string;
  /** Filesystem path to the cluster configuration directory */
  clusterPath: string;
  /** Filesystem path to the environment configuration directory */
  environmentPath: string;
  /** Environment name (e.g., 'production', 'staging') */
  environment: string;
  /** Optional kubectl context name for the cluster */
  kubeConfigContext?: string;
  /** Domain configurations mapping domain names to Route53 zone information */
  domains: Record<string, { zone_id: string; record_manager_role_arn: string; }>;
  /** Panfactum region identifier */
  region: string;
  /** AWS region identifier */
  awsRegion: string;
  /** Panfactum execution context containing configuration and logging */
  context: PanfactumContext;
  /** Service Level Agreement target (1=basic, 2=standard, 3=premium) */
  slaTarget: 1 | 2 | 3;
}