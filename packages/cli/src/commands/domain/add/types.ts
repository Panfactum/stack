import { z } from "zod";

/**
 * Schema for validating DNS zones module Terraform output
 * 
 * @remarks
 * This schema validates the output from the `aws_dns_zones` Terraform module,
 * which manages Route53 hosted zones and their associated resources.
 * 
 * The output structure includes:
 * - Zone configurations with ID, name servers, and DS records
 * - IAM role ARN for DNS record management
 * 
 * @example
 * ```typescript
 * const moduleOutput = DNS_ZONES_MODULE_OUTPUT_SCHEMA.parse(terragruntOutput);
 * const zoneId = moduleOutput.zones.value['example.com'].zone_id;
 * ```
 */
export const DNS_ZONES_MODULE_OUTPUT_SCHEMA = z.object({
    /** DNS zone configurations keyed by domain name */
    zones: z.object({
        value: z.record(z.string().describe("Domain name"), z.object({
            /** Route53 hosted zone ID */
            zone_id: z.string().describe("Route53 zone ID"),
            /** Route53 name servers for the zone */
            name_servers: z.array(z.string()).describe("DNS name servers"),
            /** DNSSEC DS record for the zone */
            ds_record: z.string().nullable().optional().describe("DNSSEC DS record")
        }).describe("DNS zone configuration"))
    }).describe("Zone data from Terraform"),
    /** IAM role ARN for managing DNS records */
    record_manager_role_arn: z.object({
        value: z.string().describe("IAM role ARN for DNS record management")
    }).describe("DNS management permissions")
}).describe("AWS DNS zones Terraform module output");

/**
 * Schema for validating registered domains module Terraform output
 * 
 * @remarks
 * This schema validates the output from the `aws_registered_domains` Terraform
 * module, which manages domain registration and associated DNS zones.
 * 
 * The output provides zone IDs for registered domains and the IAM role
 * needed for DNS record management operations.
 * 
 * @example
 * ```typescript
 * const moduleOutput = REGISTERED_DOMAINS_MODULE_OUTPUT_SCHEMA.parse(terragruntOutput);
 * const zoneId = moduleOutput.zones.value['mydomain.com'].zone_id;
 * ```
 */
export const REGISTERED_DOMAINS_MODULE_OUTPUT_SCHEMA = z.object({
    /** Registered domain zones keyed by domain name */
    zones: z.object({
        value: z.record(z.string().describe("Registered domain name"), z.object({
            /** Route53 hosted zone ID for the registered domain */
            zone_id: z.string().describe("Route53 zone ID")
        }).describe("Registered domain zone configuration"))
    }).describe("Registered domain zone data"),
    /** IAM role ARN for managing DNS records */
    record_manager_role_arn: z.object({
        value: z.string().describe("IAM role ARN for DNS record management")
    }).describe("DNS management permissions")
}).describe("AWS registered domains Terraform module output");