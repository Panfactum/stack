import type { MODULES } from "@/util/terragrunt/constants";

export type DomainConfig = {
    domain: string;
    zoneId: string;
    recordManagerRoleARN: string;
    envDir: string;
    envName: string;
    module: MODULES.AWS_REGISTERED_DOMAINS | MODULES.AWS_DNS_ZONES
}

export type DomainConfigs = {[domain: string]: DomainConfig}