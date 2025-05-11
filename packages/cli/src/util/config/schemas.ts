import { z } from "zod";
import { AWS_REGION_SCHEMA, BUCKET_NAME_SCHEMA } from "../aws/schemas";


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
  }, "Domain name must be lowercase");

export const SUBDOMAIN = z.string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "Must be a valid subdomain segment (lowercase)")
  .refine(subdomain => {
    // Check that the label is not longer than 63 characters
    return subdomain.length <= 63;
  }, "Subdomain must be 63 characters or less")
  .refine(subdomain => {
    // Ensure subdomain is lowercase
    return subdomain === subdomain.toLowerCase();
  }, "Subdomain must be lowercase");

export const PANFACTUM_CONFIG_SCHEMA = z.object({

  // Domains
  domains: z.record(DOMAIN, z.object({
    zone_id: z.string(),
    record_manager_role_arn: z.string()
  })).optional(),

  // Misc Metadata
  sla_target: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  extra_tags: z.record(z.string(), z.any()).optional(),

  // Environment Settings
  environment: z.string().optional(),
  environment_subdomain: SUBDOMAIN.optional(),

  // Region Settings
  region: z.string().optional(),

  // Inputs
  extra_inputs: z.record(z.string(), z.any()).optional(),

  // Module Source
  version: z.string().optional(),
  pf_stack_version: z.string().optional(),
  pf_stack_local_path: z.string().optional(),
  pf_stack_local_use_relative: z.boolean().optional(),
  module: z.string().optional(),

  // State Backend Setup
  tf_state_account_id: z.string().optional(),
  tf_state_profile: z.string().optional(),
  tf_state_region: AWS_REGION_SCHEMA,
  tf_state_bucket: BUCKET_NAME_SCHEMA.optional(),
  tf_state_lock_table: z.string().optional(),

  // AWS Provider
  aws_account_id: z.string().optional(),
  aws_profile: z.string().optional(),
  aws_region: AWS_REGION_SCHEMA,
  aws_secondary_account_id: z.string().optional(),
  aws_secondary_profile: z.string().optional(),
  aws_secondary_region: AWS_REGION_SCHEMA,

  // Kubernetes Provider
  kube_api_server: z.string().optional(),
  kube_name: z.string().optional(),
  kube_domain: z.string().optional(),
  kube_config_context: z.string().optional(),

  // Vault Provider
  vault_addr: z.string().optional(),

  // Authentik Provider
  authentik_url: z.string().optional(),
}).strict();

export type TGConfigFile = z.infer<typeof PANFACTUM_CONFIG_SCHEMA>;
