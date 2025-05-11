import { CheckDomainAvailabilityCommand, UnsupportedTLD } from "@aws-sdk/client-route-53-domains";
import { getRoute53DomainsClient } from "@/util/aws/clients/getRoute53DomainsClient";
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError } from "@/util/error/error";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";
import type { PanfactumContext } from "@/util/context/context";

export async function isDomainAvailableFromAWS(inputs: { context: PanfactumContext, env: EnvironmentMeta, domain: string, tld: string }) {
    const { context, env, domain, tld } = inputs;
    const { aws_profile: profile } = await getPanfactumConfig({ context, directory: env.path })
    if (!profile) {
        throw new CLIError(`Was not able to find AWS profile for '${env.name}' environment`)
    }

    try {
        await getIdentity({ context, profile })
    } catch (e) {
        throw new CLIError(`Was not able to authenticate with AWS profile '${profile}`, e)
    }

    try {
        const route53DomainsClient = await getRoute53DomainsClient({ context, profile })

        // Check domain availability
        const checkAvailabilityCommand = new CheckDomainAvailabilityCommand({
            DomainName: domain
        });

        const availabilityResponse = await route53DomainsClient.send(checkAvailabilityCommand)

        if (availabilityResponse.Availability !== 'AVAILABLE') {
            context.logger.error(
                `The domain ${domain} is not available for purchase (Status: ${availabilityResponse.Availability})\n\n` +
                `For more information on the above status code, see these docs:\n` +
                `https://docs.aws.amazon.com/Route53/latest/APIReference/API_domains_CheckDomainAvailability.html`
            );
            return false;
        }
        return true
    } catch (error) {
        if (error instanceof UnsupportedTLD) {
            context.logger.error(
                `AWS cannot be used to purchase ${domain} as AWS does not support the TLD .${tld}.\n\n` +
                `To see supported TLDs, please see these docs:\n` +
                `https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/registrar-tld-list.html\n\n` +
                `Purchase the domain using an alternative registrar such as https://www.namecheap.com/ and\n` +
                `re-run this command.`
            )
            return false;
        } else {
            throw new CLIError(`Failed to check availability for domain ${domain}`, error);
        }
    }
}