import { CheckDomainAvailabilityCommand, UnsupportedTLD } from "@aws-sdk/client-route-53-domains";
import { getRoute53DomainsClient } from "@/util/aws/clients/getRoute53DomainsClient";
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError } from "@/util/error/error";
import type { IEnvironmentMeta } from "@/util/config/getEnvironments";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for isDomainAvailableFromAWS function inputs
 */
interface IIsDomainAvailableFromAWSInputs {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Environment metadata for AWS profile lookup */
  env: IEnvironmentMeta;
  /** Domain name to check availability for */
  domain: string;
  /** Top-level domain (TLD) for validation */
  tld: string;
}

export async function isDomainAvailableFromAWS(inputs: IIsDomainAvailableFromAWSInputs): Promise<boolean> {
    const { context, env, domain, tld } = inputs;
    const { aws_profile: profile } = await getPanfactumConfig({ context, directory: env.path })
    if (!profile) {
        throw new CLIError(`Was not able to find AWS profile for '${env.name}' environment`)
    }

    await getIdentity({ context, profile })
        .catch((error: unknown) => {
            throw new CLIError(
                `Was not able to authenticate with AWS profile '${profile}`,
                error
            )
        })

    const route53DomainsClient = await getRoute53DomainsClient({ context, profile })
        .catch((error: unknown) => {
            throw new CLIError(
                `Failed to create Route53 Domains client for profile '${profile}'`,
                error
            )
        })

    // Check domain availability
    const checkAvailabilityCommand = new CheckDomainAvailabilityCommand({
        DomainName: domain
    });

    const availabilityResponse = await route53DomainsClient.send(checkAvailabilityCommand)
        .catch((error: unknown) => {
            if (error instanceof UnsupportedTLD) {
                context.logger.error(
                    `AWS cannot be used to purchase ${domain} as AWS does not support the TLD .${tld}.\n\n` +
                    `To see supported TLDs, please see these docs:\n` +
                    `https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/registrar-tld-list.html\n\n` +
                    `Purchase the domain using an alternative registrar such as https://www.namecheap.com/ and\n` +
                    `re-run this command.`
                )
                return null; // Signal that we handled the error
            }
            throw new CLIError(
                `Failed to check availability for domain ${domain}`,
                error
            );
        })

    // If we handled UnsupportedTLD error, return false
    if (availabilityResponse === null) {
        return false;
    }

    if (availabilityResponse.Availability !== 'AVAILABLE') {
        context.logger.error(
            `The domain ${domain} is not available for purchase (Status: ${availabilityResponse.Availability})\n\n` +
            `For more information on the above status code, see these docs:\n` +
            `https://docs.aws.amazon.com/Route53/latest/APIReference/API_domains_CheckDomainAvailability.html`
        );
        return false;
    }
    
    return true;
}