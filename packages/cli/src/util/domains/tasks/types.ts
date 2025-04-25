import { z } from "zod";
import { MODULES } from "@/util/terragrunt/constants";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";

export type DomainConfig = {
    domain: string;
    zoneId: string;
    recordManagerRoleARN: string;
    env: EnvironmentMeta
    module: MODULES.AWS_REGISTERED_DOMAINS | MODULES.AWS_DNS_ZONES
}

const DOMAIN_CONFIG_SCHEMA = z.object({
    domain: z.string().min(1),
    zoneId: z.string().min(1),
    recordManagerRoleARN: z.string().min(1),
    env: z.object({
      name: z.string().min(1),
      path: z.string().min(1),
    }),
    module: z.enum([MODULES.AWS_REGISTERED_DOMAINS, MODULES.AWS_DNS_ZONES])
  });

  export function validateDomainConfig(config: unknown): DomainConfig {
    return DOMAIN_CONFIG_SCHEMA.parse(config);
  }


export type DomainConfigs = {[domain: string]: DomainConfig}

const DOMAIN_CONFIGS_SCHEMA = z.record(z.string(), DOMAIN_CONFIG_SCHEMA)

export function validateDomainConfigs(config: unknown): DomainConfigs {
    return DOMAIN_CONFIGS_SCHEMA.parse(config);
  }


