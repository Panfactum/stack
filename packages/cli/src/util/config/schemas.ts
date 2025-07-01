// This file defines Zod schemas for validating Panfactum configuration files
// These schemas ensure configuration follows required formats and constraints

import { z } from "zod";
import { AWS_REGION_SCHEMA, BUCKET_NAME_SCHEMA } from "../aws/schemas";

/**
 * Schema for validating domain names
 * 
 * @remarks
 * Validates fully-qualified domain names according to DNS standards:
 * - Only lowercase letters, numbers, and hyphens allowed
 * - Each label (part between dots) must be 1-63 characters
 * - Total length must not exceed 253 characters
 * - Must start and end with alphanumeric characters
 * 
 * @example
 * ```typescript
 * DOMAIN.parse("example.com"); // Valid
 * DOMAIN.parse("sub.example.com"); // Valid
 * DOMAIN.parse("EXAMPLE.COM"); // Invalid - must be lowercase
 * DOMAIN.parse("example..com"); // Invalid - empty label
 * ```
 */
export const DOMAIN = z.string()
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/, "Must be a valid domain name (lowercase)")
  .refine(domain => {
    // Check that no label is longer than 63 characters
    const labels = domain.split('.');
    return labels.every(label => label.length <= 63);
  }, "Domain name labels must be 63 characters or less")
  .refine(domain => {
    // Check total length doesn't exceed 253 characters
    return domain.length <= 253;
  }, "Domain name must be 253 characters or less")
  .refine(domain => {
    // Ensure domain is lowercase
    return domain === domain.toLowerCase();
  }, "Domain name must be lowercase")
  .describe("Fully-qualified domain name");

/**
 * Schema for validating subdomain segments
 * 
 * @remarks
 * Validates a single subdomain label (not a full domain):
 * - Only lowercase letters, numbers, and hyphens allowed
 * - Must be 1-63 characters long
 * - Must start and end with alphanumeric characters
 * 
 * This is used for environment subdomains that get prepended
 * to the main domain (e.g., "staging" in "staging.example.com").
 * 
 * @example
 * ```typescript
 * SUBDOMAIN.parse("staging"); // Valid
 * SUBDOMAIN.parse("prod-v2"); // Valid
 * SUBDOMAIN.parse("test.env"); // Invalid - contains dot
 * SUBDOMAIN.parse("Production"); // Invalid - must be lowercase
 * ```
 */
export const SUBDOMAIN = z.string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "Must be a valid subdomain segment (lowercase)")
  .refine(subdomain => {
    // Check that the label is not longer than 63 characters
    return subdomain.length <= 63;
  }, "Subdomain must be 63 characters or less")
  .refine(subdomain => {
    // Ensure subdomain is lowercase
    return subdomain === subdomain.toLowerCase();
  }, "Subdomain must be lowercase")
  .describe("Single subdomain label");

/**
 * Schema for validating Panfactum configuration files
 * 
 * @remarks
 * This schema validates the complete Panfactum configuration structure
 * used in global.yaml, environment.yaml, region.yaml, and module.yaml files.
 * 
 * The configuration is hierarchical with values inherited and overridden:
 * - Global config provides defaults for all environments
 * - Environment config overrides global for that environment
 * - Region config overrides environment for that region
 * - Module config overrides region for that specific module
 * 
 * Key configuration sections:
 * - **Domains**: DNS zones managed by Panfactum
 * - **Environment**: Environment-specific settings
 * - **AWS**: AWS account and authentication configuration
 * - **State Backend**: Terraform state storage configuration
 * - **Kubernetes**: Cluster connection settings
 * - **Vault**: Secret management configuration
 * - **Authentik**: SSO/authentication settings
 * 
 * @example
 * ```typescript
 * const config = PANFACTUM_CONFIG_SCHEMA.parse({
 *   environment: "production",
 *   aws_region: "us-east-1",
 *   aws_account_id: "123456789012",
 *   tf_state_region: "us-east-1",
 *   domains: {
 *     "example.com": {
 *       zone_id: "Z1234567890ABC",
 *       record_manager_role_arn: "arn:aws:iam::123456789012:role/DNSManager"
 *     }
 *   }
 * });
 * ```
 * 
 * @see {@link getPanfactumConfig} - Uses this schema to validate loaded config
 */
export const PANFACTUM_CONFIG_SCHEMA = z.object({

  // Domains
  /** DNS zones managed by Panfactum with their AWS Route53 configuration */
  domains: z.record(DOMAIN, z.object({
    /** Route53 hosted zone ID */
    zone_id: z.string().describe("AWS Route53 hosted zone ID"),
    /** IAM role ARN with permissions to manage DNS records */
    record_manager_role_arn: z.string().describe("IAM role for DNS record management")
  })).optional().describe("DNS zones configuration"),

  // Misc Metadata
  /** Service Level Agreement target (1=99%, 2=99.9%, 3=99.99%) */
  sla_target: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()
    .describe("SLA target level"),
  /** Additional tags to apply to all resources */
  extra_tags: z.record(z.string(), z.any()).optional()
    .describe("Custom resource tags"),

  // Environment Settings
  /** Name of the Panfactum environment */
  environment: z.string().optional().describe("Environment name"),
  /** Subdomain prefix for this environment */
  environment_subdomain: SUBDOMAIN.optional().describe("Environment subdomain prefix"),

  // Region Settings
  /** Name of the region within the environment */
  region: z.string().optional().describe("Region name"),

  // Inputs
  /** Additional Terraform inputs to pass to modules */
  extra_inputs: z.record(z.string(), z.any()).optional()
    .describe("Extra Terraform module inputs"),

  // Module Source
  /** Version tag for module source */
  version: z.string().optional().describe("Module version"),
  /** Panfactum stack version to use */
  pf_stack_version: z.string().optional().describe("Panfactum stack version"),
  /** Local path to Panfactum stack for development */
  pf_stack_local_path: z.string().optional().describe("Local stack path"),
  /** Whether to use relative paths for local stack */
  pf_stack_local_use_relative: z.boolean().optional().describe("Use relative paths"),
  /** Name of the module being configured */
  module: z.string().optional().describe("Module name"),

  // State Backend Setup
  /** AWS account ID containing the Terraform state bucket */
  tf_state_account_id: z.string().optional().describe("State backend AWS account"),
  /** AWS profile for accessing the state backend */
  tf_state_profile: z.string().optional().describe("State backend AWS profile"),
  /** AWS region containing the state bucket */
  tf_state_region: AWS_REGION_SCHEMA.describe("State backend AWS region"),
  /** S3 bucket name for Terraform state storage */
  tf_state_bucket: BUCKET_NAME_SCHEMA.optional().describe("State storage S3 bucket"),
  /** DynamoDB table for Terraform state locking */
  tf_state_lock_table: z.string().optional().describe("State lock DynamoDB table"),

  // AWS Provider
  /** Primary AWS account ID for resource deployment */
  aws_account_id: z.string().optional().describe("Primary AWS account ID"),
  /** Primary AWS profile for authentication */
  aws_profile: z.string().optional().describe("Primary AWS profile"),
  /** Primary AWS region for resource deployment */
  aws_region: AWS_REGION_SCHEMA.describe("Primary AWS region"),
  /** Secondary AWS account ID for cross-account resources */
  aws_secondary_account_id: z.string().optional().describe("Secondary AWS account ID"),
  /** Secondary AWS profile for cross-account access */
  aws_secondary_profile: z.string().optional().describe("Secondary AWS profile"),
  /** Secondary AWS region for cross-region resources */
  aws_secondary_region: AWS_REGION_SCHEMA.describe("Secondary AWS region"),

  // Kubernetes Provider
  /** Kubernetes API server endpoint URL */
  kube_api_server: z.string().optional().describe("Kubernetes API server URL"),
  /** Name identifier for the Kubernetes cluster */
  kube_name: z.string().optional().describe("Kubernetes cluster name"),
  /** Domain name for Kubernetes ingress */
  kube_domain: z.string().optional().describe("Kubernetes ingress domain"),
  /** kubectl context name for cluster access */
  kube_config_context: z.string().optional().describe("kubectl context name"),

  // Vault Provider
  /** HashiCorp Vault server address */
  vault_addr: z.string().optional().describe("Vault server URL"),
  /** Vault authentication token */
  vault_token: z.string().optional().describe("Vault auth token"),

  // Authentik Provider
  /** Authentik SSO server URL */
  authentik_url: z.string().optional().describe("Authentik server URL"),
  /** Authentik API authentication token */
  authentik_token: z.string().optional().describe("Authentik API token")
}).strict().describe("Panfactum configuration schema");

/**
 * Type representing a validated Panfactum configuration file
 */
export type TGConfigFile = z.infer<typeof PANFACTUM_CONFIG_SCHEMA>;
