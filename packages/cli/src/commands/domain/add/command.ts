import { confirm, input } from "@inquirer/prompts";
import { Command, Option } from "clipanion";
import { Listr } from "listr2";
import { ZodError } from "zod";
import { applyColors } from "@/util/colors/applyColors";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { getEnvironments, type EnvironmentMeta } from "@/util/config/getEnvironments";
import { DOMAIN } from "@/util/config/schemas";
import { isRegistered } from "@/util/domains/isRegistered";
import { getZonesTask } from "@/util/domains/tasks/getZonesTask";
import { CLIError } from "@/util/error/error";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { createDescendentZones } from "./createDescendentZones";
import { createEnvironmentSubzones } from "./createEnvironmentSubzones";
import { getEnvironmentForZone } from "./getEnvironmentForZone";
import { manualZoneSetup } from "./manualZoneSetup";
import { registerDomain } from "./registerDomain";

export class DomainAddCommand extends PanfactumCommand {
    static override paths = [["domain", "add"]];

    static override usage = Command.Usage({
        description: "Add a domain to the Panfactum framework installation",
        details:
            "Connects a domain to the Panfactum framework installation so that created infrastructure can interact with it and its subdomains.",
    });

    environment: string | undefined = Option.String("--environment,-e", {
        description: "The environment to add the domain to",
        arity: 1
    });

    domain: string | undefined = Option.String("--domain,-d", {
        description: "The domain to add to the Panfactum installation",
        arity: 1
    });

    forceIsRegistered: boolean | undefined = Option.Boolean("--force-is-registerd", {
        description: "Use this to override our heuristic for determining whether the provided domain is already registered.",

    })

    async execute() {
        const { context, environment, domain, forceIsRegistered = false } = this

        let newDomain = domain;

        /////////////////////////////////////////////////////////////////////////
        // Validations
        /////////////////////////////////////////////////////////////////////////
        let environmentMeta: EnvironmentMeta | undefined;
        const environments = await getEnvironments(context)
        if (environment) {
            const environmentMetaIndex = environments.findIndex(actualEnv => actualEnv.name === environment)
            if (environmentMetaIndex === -1) {
                throw new CLIError(`The environment ${environment} does not exist.`)
            } else if (environment === MANAGEMENT_ENVIRONMENT) {
                throw new CLIError(`Domains cannot be added to the ${MANAGEMENT_ENVIRONMENT} environment.`)
            } else {
                environmentMeta = environments[environmentMetaIndex]!
            }
        }

        /////////////////////////////////////////////////////////////////////////
        // Download valid domain suffices
        /////////////////////////////////////////////////////////////////////////

        let domainSuffices: string[];

        try {
            const suffixList = await (await globalThis.fetch("https://publicsuffix.org/list/public_suffix_list.dat")).text();
            domainSuffices = suffixList.split("\n")
                .filter(maybeSuffix => !maybeSuffix.startsWith("//") && !maybeSuffix.startsWith("*") && maybeSuffix !== "")
                .sort((a, b) => b.length - a.length) // longest first
        } catch (e) {
            throw new CLIError("Failed to fetch domain apex suffices", e)
        }

        /////////////////////////////////////////////////////////////////////////
        // Get the domain
        /////////////////////////////////////////////////////////////////////////

        if (!newDomain) {
            newDomain = await input({
                message: applyColors("Enter domain:", { style: "question" }),
                required: true,
                validate: async (val) => {
                    const { error } = DOMAIN.safeParse(val)
                    if (error) {
                        return applyColors(error.issues[0]?.message ?? "Invalid domain", { style: "error" })
                    }
                    if (!domainSuffices.some(suffix => val.endsWith(`.${suffix}`))) {
                        return applyColors("TLD not recognized", { style: "error" })
                    }
                    return true
                }
            })
        } else {
            try {
                newDomain = DOMAIN.parse(newDomain)
            } catch (e) {
                if (e instanceof ZodError) {
                    throw new CLIError("Invalid domain format", e)
                } else {
                    throw new CLIError("Failed to parse domain", e)
                }
            }
        }

        /////////////////////////////////////////////////////////////////////////
        // Check if apex
        /////////////////////////////////////////////////////////////////////////
        let isApex = false;
        let tld = ""
        let apexDomain = ""
        for (const suffix of domainSuffices) {
            const suffixTest = `.${suffix}`
            if (newDomain.endsWith(suffixTest)) {
                const domainWithoutSuffix = newDomain.slice(0, -suffixTest.length);
                const domainLabels = domainWithoutSuffix.split('.')
                tld = suffix;
                apexDomain = `${domainLabels[domainLabels.length - 1]}.${tld}`
                if (domainLabels.length === 1 && domainLabels[0] !== "") {
                    isApex = true
                }
                break;
            }
        }

        /////////////////////////////////////////////////////////////////////////
        // Check if already added
        /////////////////////////////////////////////////////////////////////////
        context.logger.log(
            applyColors(`Verifying if ${newDomain} has already been added to this Panfactum installation.`, {
                highlights: [
                    { phrase: newDomain, style: "important" },
                    { phrase: "apex domain", style: "warning" }
                ]
            }),
            { trailingNewlines: 1, leadingNewlines: 1 }
        )

        const { task, domainConfigs } = await getZonesTask({ context })
        await new Listr(task).run()

        const [_, existingDomainConfig] = Object.entries(domainConfigs)
            .find(([domain]) => {
                return domain === newDomain
            }) ?? []


        if (existingDomainConfig) {

            // TODO: Verify if environment is different from the environment where the domain is deployed

            context.logger.log(
                applyColors(`You've already added ${newDomain} to ${existingDomainConfig.env.name}.`,
                    { highlights: [newDomain, existingDomainConfig.env.name] }),
                { trailingNewlines: 1, leadingNewlines: 1 }
            )

            ////////////////////////////////////////////////////////
            // Environment subzones - Auto
            ////////////////////////////////////////////////////////
            await createEnvironmentSubzones({
                context,
                domain: newDomain,
                existingDomainConfigs: domainConfigs
            })

        }

        /////////////////////////////////////////////////////////////////////////
        // Main Logic 
        /////////////////////////////////////////////////////////////////////////

        if (isApex) {

            ////////////////////////////////////////////////////////
            // Check if domain is already registered
            ////////////////////////////////////////////////////////
            if (forceIsRegistered || await isRegistered({ domain: newDomain, context })) {
                context.logger.log(
                    applyColors(`${newDomain} has been purchased but has not been added to Panfactum yet.`, {
                        highlights: [
                            { phrase: newDomain, style: "important" },
                            { phrase: "not", style: "warning" }
                        ]
                    }),
                    { trailingNewlines: 1, leadingNewlines: 1 }
                )

                ////////////////////////////////////////////////////////
                // Confirm the user is the owner
                ////////////////////////////////////////////////////////

                const ownsDomain = await confirm({
                    message: applyColors(`Are you the owner of ${newDomain}?`, { style: "question", highlights: [newDomain] }),
                    default: true
                })

                if (!ownsDomain) {
                    context.logger.log(
                        applyColors(`You cannot add ${newDomain} to Panfactum unless you own it.`, { highlights: [newDomain], style: "error" }),
                        { trailingNewlines: 1, leadingNewlines: 1 }
                    )
                    return 1
                }

                ////////////////////////////////////////////////////////
                // Check whether the user wants Panfactum to host the domain
                ////////////////////////////////////////////////////////
                context.logger.log(
                    applyColors(
                        `In order for Panfactum infrastructure to run workloads that are accessible at\n` +
                        `${newDomain}, Panfactum needs to host its DNS servers.`
                        ,
                        {
                            highlights: [newDomain]
                        }),
                    { trailingNewlines: 1, leadingNewlines: 1 }
                )

                context.logger.log(
                    applyColors(
                        `WARNING: We do NOT recommend this if you are already hosting records under ${newDomain}\n` +
                        `as this will invalidate existing DNS records.`,
                        {
                            style: "warning",
                            highlights: [newDomain]
                        }),
                    { trailingNewlines: 1 }
                )

                context.logger.log(
                    applyColors(
                        `If you choose to skip this step, you can still run workloads under subdomains such\n` +
                        `as <your_subdomain>.${domain}, but you should re-run with these arguments:\n\n`,
                        {
                            highlights: [`<your_subdomain>.${newDomain}`, newDomain]
                        }) + `pf domain add -d <your_subdomain>.${newDomain}`,
                    { trailingNewlines: 1 }
                )

                const shouldHostZone = await confirm({
                    message: applyColors(`Would you like to configure Panfactum to host the DNS for ${newDomain}?`, { style: "question", highlights: [newDomain] }),
                    default: true
                })

                if (shouldHostZone) {

                    ////////////////////////////////////////////////////////
                    // Get environment
                    ////////////////////////////////////////////////////////
                    environmentMeta = await getEnvironmentForZone({ context, domain: newDomain, environmentMeta, shouldBeProduction: true })

                    ////////////////////////////////////////////////////////
                    // Zone Setup - Manual
                    ////////////////////////////////////////////////////////

                    context.logger.log(
                        applyColors(
                            `Deploying DNS zone for ${newDomain} in ${environmentMeta.name}...`,
                            {
                                highlights: [newDomain]
                            }),
                        { leadingNewlines: 1, trailingNewlines: 1 }
                    )

                    const apexConfig = await manualZoneSetup({ context, domain: newDomain, env: environmentMeta })

                    ////////////////////////////////////////////////////////
                    // Environment subzones - Auto
                    ////////////////////////////////////////////////////////
                    await createEnvironmentSubzones({
                        context,
                        domain: newDomain,
                        existingDomainConfigs: {
                            ...domainConfigs,
                            ...{
                                [newDomain]: apexConfig
                            }
                        }
                    })

                } else {

                    ////////////////////////////////////////////////////////
                    // Environment subzones - Manual
                    ////////////////////////////////////////////////////////
                    await createEnvironmentSubzones({
                        context,
                        domain: newDomain,
                        existingDomainConfigs: domainConfigs
                    })
                }
            } else {

                ////////////////////////////////////////////////////////
                // Confirm purchase
                ////////////////////////////////////////////////////////
                context.logger.log(
                    applyColors(`${newDomain} has not been added to Panfactum, and it also has not yet been purchased.`, {
                        highlights: [
                            { phrase: newDomain, style: "important" },
                            { phrase: "not", style: "warning" }
                        ]
                    }),
                    { trailingNewlines: 1, leadingNewlines: 1 }
                )

                const shouldRegister = await confirm({
                    message: applyColors(`Would you like to use Panfactum to purchase ${newDomain}?`, { style: "question", highlights: [newDomain] }),
                    default: true
                })

                if (!shouldRegister) {
                    context.logger.log(
                        applyColors(
                            `Cannot add ${newDomain} if it has not been purchased!\n\n` +
                            `While you do not need to use this CLI to purchase the domain, you will need to purchase\n` +
                            `it via an alternative mechanism such as the AWS web console:\n` +
                            `https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html\n\n` +
                            `Note that AWS does not support registering domains on all TLDs, so you may need to use an alternative registrar\n` +
                            `such as https://www.namecheap.com/.\n\n` +
                            `Either way, once you have purchased ${newDomain}, run this command to continue adding the domain to\n` +
                            `this Panfactum installation:\n\n`, {
                            style: "error",
                            highlights: [
                                { phrase: newDomain, style: "important" }
                            ]
                        }) + `pf domain add -d ${newDomain} ${environmentMeta ? `-e ${environmentMeta.name}` : ""}`,
                        { trailingNewlines: 1, leadingNewlines: 1 }
                    )
                    return 1
                }

                ////////////////////////////////////////////////////////
                // Choose environment
                ////////////////////////////////////////////////////////
                environmentMeta = await getEnvironmentForZone({ context, domain: newDomain, environmentMeta, shouldBeProduction: true })


                ////////////////////////////////////////////////////////
                // Purchase the domain
                ////////////////////////////////////////////////////////
                const registeredDomainConfig = await registerDomain({ context, env: environmentMeta, domain: newDomain, tld })

                ////////////////////////////////////////////////////////
                // Setup environment zones - Auto
                ////////////////////////////////////////////////////////
                await createEnvironmentSubzones({
                    context,
                    domain: newDomain,
                    existingDomainConfigs: {
                        ...domainConfigs,
                        ...{
                            [newDomain]: registeredDomainConfig
                        }
                    }
                })
            }

        } else {

            // Note that this handles the case where there could be multiple ancestors 
            // (e.g., `a.prod.panfactum.com` has ancestors `prod.panfactum.com` and `panfactum.com`)
            // For the below logic to work, we want to select "first" ancestor which will be the longest ancestor domain
            const [ancestorDomain, existingAncestorConfig] = Object.entries(domainConfigs)
                .filter(([domain]) => {
                    return newDomain.endsWith(`.${domain}`)
                })
                .sort(([domainA], [domainB]) => domainB.length - domainA.length)[0] ?? []

            if (ancestorDomain && existingAncestorConfig) {
                ////////////////////////////////////////////////////////
                // If subdomain and has ancestor configured with Panfactum,
                // create a new zone for the subdomain and link to nearest ancestor
                ////////////////////////////////////////////////////////
                context.logger.log(
                    applyColors(`Confirmed! You've already added its ancestor ${ancestorDomain} with ${existingAncestorConfig.module} in ${existingAncestorConfig.env.name}.`,
                        { highlights: [ancestorDomain, existingAncestorConfig.env.name] }),
                    { leadingNewlines: 1 }
                )
                environmentMeta = await getEnvironmentForZone({ context, domain: newDomain, environmentMeta })

                ////////////////////////////////////////////////////////
                // Connect with parent
                ////////////////////////////////////////////////////////
                context.logger.log(
                    applyColors(
                        `Deploying DNS zone for ${newDomain} in ${environmentMeta.name}...`,
                        {
                            highlights: [newDomain]
                        }),
                    { leadingNewlines: 1, trailingNewlines: 1 }
                )

                await createDescendentZones({
                    context,
                    ancestorZone: existingAncestorConfig,
                    descendentZones: {
                        [newDomain]: {
                            env: environmentMeta
                        }
                    }
                })

            } else {

                context.logger.log(
                    applyColors(`You haven't added ${newDomain} or any ancestor domains.`, { highlights: [newDomain] }),
                    { trailingNewlines: 1, leadingNewlines: 1 }
                )

                ////////////////////////////////////////////////////////
                // If no ancestor configured with Panfactum BUT the apex is registered,
                // let's check to see if the user want to connect the apex to Panfactum.
                ////////////////////////////////////////////////////////
                if (forceIsRegistered || await isRegistered({ domain: apexDomain, context })) {
                    context.logger.log(
                        applyColors(`However, it appears the apex domain for ${newDomain} (${apexDomain}) has already been purchased.`, {
                            highlights: [
                                { phrase: newDomain, style: "important" },
                                { phrase: apexDomain, style: "important" }
                            ]
                        }),
                        { trailingNewlines: 1 }
                    )

                    ////////////////////////////////////////////////////////
                    // Confirm the user is the owner
                    ////////////////////////////////////////////////////////

                    const ownsDomain = await confirm({
                        message: applyColors(`Are you the owner of ${apexDomain}?`, { style: "question", highlights: [apexDomain] }),
                        default: true
                    })

                    if (!ownsDomain) {
                        context.logger.log(
                            applyColors(`You cannot add ${newDomain} to Panfactum unless you own its apex domain ${apexDomain}.`, { highlights: [newDomain, apexDomain], style: "error" }),
                            { trailingNewlines: 1, leadingNewlines: 1 }
                        )
                        return 1
                    }

                    ////////////////////////////////////////////////////////
                    // (Optional) Link the apex zone to the domain registration
                    ////////////////////////////////////////////////////////
                    context.logger.log(
                        applyColors(
                            `Would you like to configure Panfactum to host the DNS servers for ${apexDomain}?\n` +
                            `This isn't required to add ${newDomain}, but it will make adding\n` +
                            `additional subdomains of ${apexDomain} easier in the future.`
                            ,
                            {
                                highlights: [newDomain, apexDomain]
                            }),
                        { trailingNewlines: 1, leadingNewlines: 1 }
                    )

                    context.logger.log(
                        applyColors(
                            `WARNING: We do NOT recommend this if you are already hosting records under ${apexDomain}\n` +
                            `as you this will invalidate existing DNS records.`,
                            {
                                style: "warning",
                                highlights: [apexDomain]
                            }),
                        { trailingNewlines: 1 }
                    )

                    const shouldHostApexZone = await confirm({
                        message: applyColors(`Would you like to configure Panfactum to host the DNS for ${apexDomain}?`, { style: "question", highlights: [apexDomain] }),
                        default: true
                    })

                    if (shouldHostApexZone) {

                        ////////////////////////////////////////////////////////
                        // Select environment for the apex domain - should be prod
                        ////////////////////////////////////////////////////////
                        const apexEnvironmentMeta = await getEnvironmentForZone({ context, domain: apexDomain, shouldBeProduction: true })

                        ////////////////////////////////////////////////////////
                        // Apex Zone Setup - Manual
                        ////////////////////////////////////////////////////////
                        const apexConfig = await manualZoneSetup({ context, domain: apexDomain, env: apexEnvironmentMeta })

                        ////////////////////////////////////////////////////////
                        // User-specified DNS Zone Setup - Auto
                        ////////////////////////////////////////////////////////
                        environmentMeta = await getEnvironmentForZone({ context, domain: newDomain, environmentMeta })

                        const descendentConfigs = await createDescendentZones({
                            context,
                            ancestorZone: apexConfig,
                            descendentZones: {
                                [newDomain]: {
                                    env: environmentMeta
                                }
                            }
                        })

                        ////////////////////////////////////////////////////////
                        // Environment subzones for user-specified Zone - Auto
                        ////////////////////////////////////////////////////////
                        await createEnvironmentSubzones({
                            context,
                            domain: newDomain,
                            existingDomainConfigs: {
                                ...domainConfigs,
                                ...descendentConfigs
                            },
                        })


                    } else {
                        ////////////////////////////////////////////////////////
                        // Select environment for the new domain
                        ////////////////////////////////////////////////////////
                        environmentMeta = await getEnvironmentForZone({ context, domain: newDomain, environmentMeta })


                        ////////////////////////////////////////////////////////
                        // User-specified Zone Setup - Manual
                        ////////////////////////////////////////////////////////
                        const domainConfig = await manualZoneSetup({ context, domain: newDomain, env: environmentMeta })

                        ////////////////////////////////////////////////////////
                        //  Environment subzones for user-specified Zone - Auto
                        ////////////////////////////////////////////////////////
                        await createEnvironmentSubzones({
                            context,
                            domain: newDomain,
                            existingDomainConfigs: {
                                ...domainConfigs,
                                ...{
                                    [newDomain]: domainConfig
                                }
                            }
                        })
                    }

                } else {
                    context.logger.log(
                        applyColors(`Moreover, it appears the apex domain for ${newDomain} (${apexDomain}) is available for purchase.`, {
                            highlights: [
                                { phrase: newDomain, style: "important" },
                                { phrase: apexDomain, style: "important" }
                            ]
                        }),
                        { trailingNewlines: 1 }
                    )

                    ////////////////////////////////////////////////////////
                    // If the apex is not registered,
                    // let's check to see if the user want to purchase it.
                    ////////////////////////////////////////////////////////
                    const shouldPurchase = await confirm({
                        message: applyColors(`Would you like to purcahse ${apexDomain}?`, { style: "question", highlights: [apexDomain] }),
                        default: true
                    })

                    if (!shouldPurchase) {
                        context.logger.log(
                            applyColors(`You cannot add ${newDomain} to Panfactum unless you own its apex domain ${apexDomain}.`, { highlights: [newDomain, apexDomain], style: "error" }),
                            { trailingNewlines: 1, leadingNewlines: 1 }
                        )
                        return 1
                    }

                    ////////////////////////////////////////////////////////
                    // Pick environment for apex domain - should be prod
                    ////////////////////////////////////////////////////////
                    const apexEnvironmentMeta = await getEnvironmentForZone({ context, domain: apexDomain, shouldBeProduction: true })

                    ////////////////////////////////////////////////////////
                    // Purchase it
                    ////////////////////////////////////////////////////////
                    const registeredDomainConfig = await registerDomain({ context, env: apexEnvironmentMeta, domain: apexDomain, tld })

                    ////////////////////////////////////////////////////////
                    // Select environment for the new domain
                    ////////////////////////////////////////////////////////
                    environmentMeta = await getEnvironmentForZone({ context, domain: newDomain, environmentMeta })

                    ////////////////////////////////////////////////////////
                    // User-specified DNS Zone Setup - Auto
                    ////////////////////////////////////////////////////////
                    const descendentConfigs = await createDescendentZones({
                        context,
                        ancestorZone: registeredDomainConfig,
                        descendentZones: {
                            [newDomain]: {
                                env: environmentMeta
                            }
                        }
                    })

                    ////////////////////////////////////////////////////////
                    // Environment Subzones Setup - Auto
                    ////////////////////////////////////////////////////////
                    await createEnvironmentSubzones({
                        context,
                        domain: newDomain,
                        existingDomainConfigs: {
                            ...domainConfigs,
                            ...descendentConfigs
                        },
                    })
                }
            }
        }
    }
}