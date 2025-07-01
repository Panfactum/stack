import { z } from "zod";
import { PanfactumZodError } from "@/util/error/error";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";

export type DomainConfig = {
    domain: string;
    zoneId: string;
    recordManagerRoleARN: string;
    env: EnvironmentMeta
}

const DOMAIN_CONFIG_SCHEMA = z.object({
    domain: z.string().min(1),
    zoneId: z.string().min(1),
    recordManagerRoleARN: z.string().min(1),
    env: z.object({
        name: z.string().min(1),
        path: z.string().min(1),
        deployed: z.boolean()
    }),
});

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

const DOMAIN_CONFIGS_SCHEMA = z.record(z.string(), DOMAIN_CONFIG_SCHEMA)

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


