import { z } from "zod";
import { PanfactumZodError } from "@/util/error/error";
import type { IEnvironmentMeta } from "@/util/config/getEnvironments";

export type DomainConfig = {
    domain: string;
    zoneId: string;
    recordManagerRoleARN: string;
    env: IEnvironmentMeta
}

/**
 * Schema for validating domain configuration objects
 * 
 * @remarks
 * This schema validates domain configuration data used throughout the Panfactum
 * CLI for DNS management operations. Each domain config represents a fully
 * configured DNS zone with its associated environment and AWS resources.
 * 
 * The schema enforces:
 * - Non-empty string validation for all required fields
 * - Proper environment metadata structure
 * - AWS IAM role ARN format (through string validation)
 * 
 * Domain configurations are typically loaded from:
 * - Environment configuration files
 * - Terragrunt outputs
 * - AWS Route53 zone discoveries
 * - Manual domain setup operations
 * 
 * @example
 * ```typescript
 * const domainConfig = DOMAIN_CONFIG_SCHEMA.parse({
 *   domain: "api.example.com",
 *   zoneId: "Z1234567890ABC",
 *   recordManagerRoleARN: "arn:aws:iam::123456789012:role/route53-manager",
 *   env: {
 *     name: "production",
 *     path: "/environments/production",
 *     deployed: true
 *   }
 * });
 * ```
 * 
 * @see {@link validateDomainConfig} - For safe parsing with error handling
 * @see {@link IEnvironmentMeta} - For environment metadata structure
 */
const DOMAIN_CONFIG_SCHEMA = z.object({
    /** Domain name (e.g., "api.example.com", "example.com") */
    domain: z.string().min(1).describe("Domain name"),
    /** Route53 hosted zone ID where DNS records are managed */
    zoneId: z.string().min(1).describe("Route53 hosted zone ID"),
    /** AWS IAM role ARN with permissions to manage DNS records */
    recordManagerRoleARN: z.string().min(1).describe("IAM role ARN for DNS record management"),
    /** Environment metadata including deployment status */
    env: z.object({
        /** Environment name (e.g., "production", "staging") */
        name: z.string().min(1).describe("Environment name"),
        /** File system path to environment configuration */
        path: z.string().min(1).describe("Environment configuration path"),
        /** Whether environment is currently deployed */
        deployed: z.boolean().describe("Environment deployment status")
    }).describe("Environment metadata")
}).describe("Domain configuration with AWS resources and environment details");

export function validateDomainConfig(config: unknown): DomainConfig {
    const parseResult = DOMAIN_CONFIG_SCHEMA.safeParse(config);
    if (!parseResult.success) {
        throw new PanfactumZodError(
            'Invalid domain config',
            'domain configuration',
            parseResult.error
        );
    }
    return parseResult.data;
}


export type DomainConfigs = { [domain: string]: DomainConfig }

/**
 * Schema for validating collections of domain configurations
 * 
 * @remarks
 * This schema validates a record (key-value mapping) where each key is a domain
 * name and each value is a domain configuration object. This structure is used
 * throughout the Panfactum CLI to manage multiple domains within an environment
 * or across environments.
 * 
 * The schema enforces:
 * - String keys representing domain names
 * - Valid domain configuration objects as values
 * - Proper structure for batch domain operations
 * 
 * Common use cases:
 * - Loading all domains from environment configuration
 * - Batch domain validation operations
 * - Domain discovery from Terragrunt outputs
 * - Multi-domain DNS setup and management
 * 
 * @example
 * ```typescript
 * const domainConfigs = DOMAIN_CONFIGS_SCHEMA.parse({
 *   "api.example.com": {
 *     domain: "api.example.com",
 *     zoneId: "Z1234567890ABC",
 *     recordManagerRoleARN: "arn:aws:iam::123456789012:role/route53-manager",
 *     env: { name: "production", path: "/environments/production", deployed: true }
 *   },
 *   "staging.example.com": {
 *     domain: "staging.example.com",
 *     zoneId: "Z9876543210XYZ",
 *     recordManagerRoleARN: "arn:aws:iam::123456789012:role/route53-manager",
 *     env: { name: "staging", path: "/environments/staging", deployed: true }
 *   }
 * });
 * ```
 * 
 * @see {@link validateDomainConfigs} - For safe parsing with error handling
 * @see {@link DOMAIN_CONFIG_SCHEMA} - For individual domain configuration validation
 */
const DOMAIN_CONFIGS_SCHEMA = z.record(z.string(), DOMAIN_CONFIG_SCHEMA)
  .describe("Collection of domain configurations mapped by domain name")

export function validateDomainConfigs(config: unknown): DomainConfigs {
    const parseResult = DOMAIN_CONFIGS_SCHEMA.safeParse(config);
    if (!parseResult.success) {
        throw new PanfactumZodError(
            'Invalid domain configs',
            'domain configuration',
            parseResult.error
        );
    }
    return parseResult.data;
}


