import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import type { PanfactumContext } from "@/context/context";
import { getIdentity } from "@/util/aws/getIdentity";
import { applyColors } from "@/util/colors/applyColors";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";
import { CLIError } from "@/util/error/error";
import { CheckDomainAvailabilityCommand, Route53DomainsClient, UnsupportedTLD } from "@aws-sdk/client-route-53-domains";

export async function isDomainAvailableFromAWS(inputs: {context: PanfactumContext, env:EnvironmentMeta, domain: string, tld: string }){
    const {context, env, domain, tld} = inputs;
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
        const route53DomainsClient = new Route53DomainsClient({
            profile,
            region: "us-east-1"
        });

        // Check domain availability
        const checkAvailabilityCommand = new CheckDomainAvailabilityCommand({
            DomainName: domain
        });

        const availabilityResponse = await route53DomainsClient.send(checkAvailabilityCommand)

        if (availabilityResponse.Availability !== 'AVAILABLE') {
            context.logger.log(
                applyColors(
                    `The domain ${domain} is not available for purchase (Status: ${availabilityResponse.Availability})\n\n` +
                    `For more information on the above status code, see these docs:\n` +
                    `https://docs.aws.amazon.com/Route53/latest/APIReference/API_domains_CheckDomainAvailability.html`, {
                    style: "error",
                    highlights: [
                        { phrase: domain, style: "important" },
                        { phrase: availabilityResponse.Availability || 'UNKNOWN', style: "warning" }
                    ]
                }),
                { trailingNewlines: 1, leadingNewlines: 1 }
            );
            return false;
        }
        return true
    } catch (error) {
        if (error instanceof UnsupportedTLD) {
            context.logger.log(
                applyColors(
                    `AWS cannot be used to purchase ${domain} as AWS does not support the TLD .${tld}.\n\n` +
                    `To see supported TLDs, please see these docs:\n` +
                    `https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/registrar-tld-list.html\n\n` +
                    `Purchase the domain using an alternative registrar such as https://www.namecheap.com/ and\n` +
                    `re-run this command.`,
                    { style: "error", highlights: [domain, `.${tld}`] }
                ),
                {leadingNewlines: 1, trailingNewlines: 1}
            )
            return false;
        } else {
            throw new CLIError(`Failed to check availability for domain ${domain}`, error);
        }
    }
}