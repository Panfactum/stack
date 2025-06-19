import { ListPricesCommand } from "@aws-sdk/client-route-53-domains";
import { z } from "zod";
import { getRoute53DomainsClient } from "@/util/aws/clients/getRoute53DomainsClient";
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";
import type { PanfactumContext } from "@/util/context/context";

// Zod schema for validating Route53 Domains pricing response
const priceItemSchema = z.object({
    RegistrationPrice: z.object({
        Price: z.number()
    }).optional()
}).passthrough();

const listPricesResponseSchema = z.object({
    Prices: z.array(priceItemSchema).optional()
}).passthrough();

export async function getDomainPrice(inputs: {
    context: PanfactumContext;
    env: EnvironmentMeta;
    tld: string;
}): Promise<number> {
    const { context, env, tld } = inputs;

    const { aws_profile: profile } = await getPanfactumConfig({ context, directory: env.path });
    if (!profile) {
        throw new CLIError(`Was not able to find AWS profile for '${env.name}' environment`);
    }

    await getIdentity({ context, profile })
        .catch((error: unknown) => {
            throw new CLIError(
                `Was not able to authenticate with AWS profile '${profile}'`,
                error
            );
        });

    const route53DomainsClient = await getRoute53DomainsClient({ context, profile })
        .catch((error: unknown) => {
            throw new CLIError(
                `Failed to create Route53 Domains client for profile '${profile}'`,
                error
            );
        });
        
    const listPricesCommand = new ListPricesCommand({
        Tld: tld,
    });

    const priceResponse = await route53DomainsClient.send(listPricesCommand)
        .catch((error: unknown) => {
            throw new CLIError(
                `Failed to get pricing information for TLD .${tld}`,
                error
            );
        });

    // Validate the response
    const validationResult = listPricesResponseSchema.safeParse(priceResponse);
    if (!validationResult.success) {
        throw new PanfactumZodError(
            `Invalid pricing response format for TLD .${tld}`,
            'Route53 Domains ListPrices API',
            validationResult.error
        );
    }

    const validatedResponse = validationResult.data;
    
    if (validatedResponse.Prices?.length) {
        const registrationPrice = validatedResponse.Prices.find(
            (price) => price.RegistrationPrice?.Price !== undefined
        )?.RegistrationPrice?.Price;
        if (registrationPrice !== undefined) {
            return registrationPrice;
        }
    }

    throw new CLIError(`No registration prices returned for TLD .${tld}`);
}