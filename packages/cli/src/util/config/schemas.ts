import { z } from "zod";

export const AWS_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "af-south-1",
  "ap-east-1",
  "ap-south-1",
  "ap-south-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-southeast-4",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "ca-central-1",
  "ca-west-1",
  "eu-central-1",
  "eu-central-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-south-1",
  "eu-south-2",
  "eu-north-1",
  "il-central-1",
  "me-south-1",
  "me-central-1",
  "sa-east-1",
  "us-gov-east-1",
  "us-gov-west-1",
] as const;

const AWS_REGION_SCHEMA = z
  .string()
  .refine((region) => (AWS_REGIONS as readonly string[]).includes(region), {
    message: "Not a valid AWS region",
  })
  .optional();


export const BUCKET_NAME_SCHEMA = z.string()
.max(63, "S3 bucket names must be less than 64 characters long")
.min(3, "S3 bucket names must be at least three characters")
.regex(/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/, "S3 bucket names can only contain lowercase letters, numbers, periods, and hyphens, and must begin and end with a letter or number")
.refine(val => !val.includes(".."), "S3 bucket names must not contain adjacent periods")
.refine(val => !val.endsWith("-s3alias") && !val.endsWith("--ol-s3") && !val.endsWith(".mrap") && !val.endsWith("--x-s3") && !val.endsWith("--table-s3"), "S3 bucket names must not end with any of: -s3alias, --ol-s3, .mrap, --x-s3, --table-s3")
.refine(val => !val.startsWith("xn--") && !val.startsWith("sthree-") && !val.startsWith("amzn-s3-demo-"), "S3 bucket names must not start with any of: xn--, sthree-, amzn-s3-demo-")
.refine(val => {
  // Check if the bucket name is formatted like an IP address
  const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  return !ipv4Regex.test(val);
}, "S3 bucket names must not be formatted as IP addresses")



export const PANFACTUM_CONFIG_SCHEMA = z.object({
  // Global Settings
  control_plane_domain: z.string().optional(),

  // Misc Metadata
  sla_target: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  extra_tags: z.record(z.string(), z.any()).optional(),

  // Environment Settings
  environment: z.string().optional(),
  environment_suddomain: z.string().optional(),

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
  kube_subdomain: z.string().optional(),
  kube_config_context: z.string().optional(),

  // Vault Provider
  vault_addr: z.string().optional(),

  // Authentik Provider
  authentik_url: z.string().optional(),
});

export type TGConfigFile = z.infer<typeof PANFACTUM_CONFIG_SCHEMA>;
