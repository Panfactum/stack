import { join } from "node:path";

import { GetContactInformationCommand } from "@aws-sdk/client-account";
import {
    Route53Client,
    ListHostedZonesByNameCommand,
    type HostedZone
} from "@aws-sdk/client-route-53";
import { ContactType, CountryCode, GetOperationDetailCommand, RegisterDomainCommand, ResendOperationAuthorizationCommand, Route53DomainsClient, type ContactDetail } from "@aws-sdk/client-route-53-domains";
import { Listr } from "listr2";
import { z, ZodError } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import moduleHCL from "@/templates/aws_registered_domains.hcl" with { type: "file" };
import { getAccountClient } from "@/util/aws/clients/getAccountClient";
import { getIdentity } from "@/util/aws/getIdentity";
import { COUNTRY_CODES } from "@/util/aws/schemas";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { validateDomainConfig, type DomainConfig } from "@/util/domains/tasks/types";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { runTasks } from "@/util/listr/runTasks";
import { GLOBAL_REGION, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { getDomainPrice } from "./getDomainPrice";
import { isDomainAvailableFromAWS } from "./isDomainAvailableFromAWS";
import { REGISTERED_DOMAINS_MODULE_OUTPUT_SCHEMA } from "./types";
import type { EnvironmentMeta } from "@/util/config/getEnvironments";
import type { PanfactumContext } from "@/util/context/context";

// Constants for validation
const MIN_NAME_LENGTH = 2;
const MAX_LENGTH = 128;
const MIN_ADDRESS_LENGTH = 5;
const MIN_CITY_LENGTH = 2;


const CONTACT_INFO_SCHEMA = z.object({
    organization_name: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email_address: z.string().email().optional(),
    phone_number: z.string().optional().catch(undefined),
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip_code: z.string().optional(),
    country_code: z.string().length(2).optional().catch(undefined)
})

export async function registerDomain(inputs: {
    domain: string,
    env: EnvironmentMeta,
    context: PanfactumContext,
    tld: string
}): Promise<DomainConfig> {
    const { context, env, domain, tld } = inputs;

    const domainConfig: Partial<DomainConfig> = {
        domain,
        env,
    }

    ////////////////////////////////////////////////////////
    // Verify the domain is available 
    ////////////////////////////////////////////////////////
    // TODO: @jack - Make a part of the task list
    if (!await isDomainAvailableFromAWS({ context, domain, env, tld })) {
        throw new CLIError('Domain not available from AWS')
    }

    ////////////////////////////////////////////////////////
    // Confirm the price
    ////////////////////////////////////////////////////////
    // TODO: @jack - Make a part of the task list
    const price = await getDomainPrice({ context, env, tld })
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
    await context.logger.input({
        explainer: context.logger.applyColors(`Purchasing ${domain} will charge your AWS account ${formattedPrice}.`, { highlights: [formattedPrice] }),
        message: context.logger.applyColors(`Type '${price}' to purchase:`, { style: "question", highlights: [String(price)] }),
        required: true,
        validate: (val) => {
            return val === String(price) ? true : context.logger.applyColors(`You must type '${price}' to continue.`, { style: 'error' })
        }
    })

    ////////////////////////////////////////////////////////
    // Register the domain
    ////////////////////////////////////////////////////////

    const { aws_profile: profile } = await getPanfactumConfig({ context, directory: env.path });
    if (!profile) {
        throw new CLIError(`Was not able to find AWS profile for '${env.name}' environment`);
    }

    try {
        await getIdentity({ context, profile });
    } catch (error) {
        throw new CLIError(`Was not able to authenticate with AWS profile '${profile}'`, error);
    }

    const route53DomainsClient = new Route53DomainsClient({
        profile,
        region: "us-east-1"
    });

    const route53Client = new Route53Client({
        profile,
        region: "us-east-1"
    });

    let contactInfo: z.infer<typeof CONTACT_INFO_SCHEMA> = {}
    const registeredDomainsModuleYAMLPath = join(env.path, GLOBAL_REGION, MODULES.AWS_REGISTERED_DOMAINS, "module.yaml")
    if (await fileExists(registeredDomainsModuleYAMLPath)) {
        const moduleConfig = await readYAMLFile({
            context,
            filePath: registeredDomainsModuleYAMLPath,
            validationSchema: z.object({
                extra_inputs: z.object({
                    registrant_contact: CONTACT_INFO_SCHEMA.optional()
                }).optional()
            })
        })
        contactInfo = moduleConfig?.extra_inputs?.registrant_contact ?? {}
    }

    const needsMoreInfo = !contactInfo.address_line_1 ||
        !contactInfo.email_address ||
        !contactInfo.first_name ||
        !contactInfo.last_name ||
        !contactInfo.phone_number ||
        !contactInfo.zip_code ||
        !contactInfo.state ||
        !contactInfo.organization_name ||
        !contactInfo.country_code

    interface TaskContext {
        contactInfo: typeof contactInfo,
        opId?: string;
        zoneId?: string;
    }

    const tasks = new Listr<TaskContext>([], {
        ctx: { contactInfo },
        rendererOptions: {
            collapseErrors: false
        }
    })


    //////////////////////////////////////////////////////////
    // Get contact information (if needed)
    //////////////////////////////////////////////////////////

    if (needsMoreInfo) {
        tasks.add({
            title: `Get contact info`,
            task: async (ctx, task) => {
                const contactDefaults = await getPrimaryContactDefaults(profile, context);
                task.output = context.logger.applyColors(
                    `We need to collect contact information for the domain registration.\n` +
                    `This information will be used to register ${domain} and will be visible to the domain registrar (AWS).`,
                    { style: "warning" }
                )
                if (!ctx.contactInfo.first_name) {
                    ctx.contactInfo.first_name = await context.logger.input({
                        task,
                        message: 'First Name:',
                        default: contactDefaults?.fullName?.split(" ")[0],
                        validate: (value) => {
                            if (value.length < MIN_NAME_LENGTH) {
                                return `Must be at least ${MIN_NAME_LENGTH} characters`;
                            } else if (value.length > MAX_LENGTH) {
                                return `Cannot be greater than ${MAX_LENGTH} characters`;
                            } else {
                                return true;
                            }
                        }
                    });
                }

                if (!ctx.contactInfo.last_name) {
                    ctx.contactInfo.last_name = await context.logger.input({
                        task,
                        message: 'Last Name:',
                        default: contactDefaults?.fullName?.split(" ")[1],
                        validate: (value) => {
                            if (value.length < MIN_NAME_LENGTH) {
                                return `Must be at least ${MIN_NAME_LENGTH} characters`;
                            } else if (value.length > MAX_LENGTH) {
                                return `Cannot be greater than ${MAX_LENGTH} characters`;
                            } else {
                                return true;
                            }
                        }
                    });
                }

                if (!ctx.contactInfo.organization_name) {
                    ctx.contactInfo.organization_name = await context.logger.input({
                        task,
                        message: 'Organization / Company Name (Optional):',
                        default: contactDefaults?.organizationName || "",
                        required: false,
                        validate: (value) => {
                            if (value.length < MIN_NAME_LENGTH) {
                                return `Must be at least ${MIN_NAME_LENGTH} characters`;
                            } else if (value.length > MAX_LENGTH) {
                                return `Cannot be greater than ${MAX_LENGTH} characters`;
                            } else {
                                return true;
                            }
                        }
                    });
                }

                if (!ctx.contactInfo.email_address) {
                    ctx.contactInfo.email_address = await context.logger.input({
                        task,
                        message: 'Email:',
                        default: contactDefaults?.email,
                        validate: (value) => {
                            const { error } = z.string().email().safeParse(value);
                            if (error) {
                                return error.issues[0]?.message ?? "Invalid email";
                            } else {
                                return true;
                            }
                        }
                    });
                }

                if (!ctx.contactInfo.phone_number) {
                    ctx.contactInfo.phone_number = await context.logger.input({
                        task,
                        message: 'Phone # (format: +1.1234567890):',
                        default: contactDefaults?.phoneNumber,
                        validate: (value) => {
                            if (!value.match(/^\+\d{1,3}\.\d{1,26}$/)) {
                                return "Phone numbers must be in the format +[country dialing code].[number including any area code], e.g., +1.1234567890";
                            } else if (value.length > 30) {
                                return "Phone number cannot be longer than 30 characters";
                            } else {
                                return true;
                            }
                        }
                    });
                }

                if (!ctx.contactInfo.country_code) {
                    ctx.contactInfo.country_code = await context.logger.search<string>({
                        task,
                        message: 'Country:',
                        source: (term) => {
                            return term ? COUNTRY_CODES.filter(({ name }) => name.toLowerCase().includes(term.toLowerCase())) : COUNTRY_CODES
                        }
                    });
                }

                if (!ctx.contactInfo.address_line_1) {
                    ctx.contactInfo.address_line_1 = await context.logger.input({
                        task,
                        message: 'Street Address 1:',
                        default: contactDefaults?.addressLine1,
                        validate: (value) => {
                            if (value.length < MIN_ADDRESS_LENGTH) {
                                return `Must be at least ${MIN_ADDRESS_LENGTH} characters`;
                            } else if (value.length > MAX_LENGTH) {
                                return `Cannot be greater than ${MAX_LENGTH} characters`;
                            } else {
                                return true;
                            }
                        }
                    });

                    ctx.contactInfo.address_line_2 = await context.logger.input({
                        task,
                        message: 'Street Address 2:',
                        default: contactDefaults?.addressLine2,
                        required: false,
                        validate: (value) => {
                            if (!value) {
                                return true;
                            } else if (value.length < 2) {
                                return `Must be at least ${2} characters`;
                            } else if (value.length > MAX_LENGTH) {
                                return `Cannot be greater than ${MAX_LENGTH} characters`;
                            } else {
                                return true;
                            }
                        }
                    });

                    if (ctx.contactInfo.address_line_2 === "") {
                        delete ctx.contactInfo.address_line_2
                    }
                }

                if (!ctx.contactInfo.city) {
                    ctx.contactInfo.city = await context.logger.input({
                        task,
                        message: 'City:',
                        default: contactDefaults?.city,
                        validate: (value) => {
                            if (value.length < MIN_CITY_LENGTH) {
                                return `Must be at least ${MIN_CITY_LENGTH} characters`;
                            } else if (value.length > MAX_LENGTH) {
                                return `Cannot be greater than ${MAX_LENGTH} characters`;
                            } else {
                                return true;
                            }
                        }
                    });
                }

                if (!ctx.contactInfo.state) {
                    ctx.contactInfo.state = await context.logger.input({
                        task,
                        message: 'State/Region:',
                        default: contactDefaults?.state,
                        validate: (value) => {
                            const maxLength = ctx.contactInfo.country_code === "US" ? 2 : MAX_LENGTH
                            if (value.length < 2) {
                                return `Must be at least 2 characters`;
                            } else if (value.length > maxLength) {
                                return `Cannot be greater than ${maxLength} characters`;
                            } else {
                                return true;
                            }
                        }
                    });
                }

                if (!ctx.contactInfo.zip_code) {
                    ctx.contactInfo.zip_code = await context.logger.input({
                        task,
                        message: 'Postal Code:',
                        default: contactDefaults?.zipCode,
                        validate: (value) => {
                            if (!/^[0-9A-Z -]+$/.test(value)) {
                                return "Can only contain numbers, uppercase letters, hyphens, and spaces";
                            } else if ((value.match(/[0-9A-Z]/g) || []).length < 2) {
                                return "Must contain at least 2 numbers or letters";
                            } else if (/^[ -]|[ -]$/.test(value)) {
                                return "Cannot start or end with a space or hyphen";
                            } else {
                                return true;
                            }
                        }
                    });
                }
            }
        })
    }

    //////////////////////////////////////////////////////////
    // Register Domain
    //////////////////////////////////////////////////////////
    tasks.add(
        {
            title: `Submitting registration request to AWS`,
            task: async (ctx, task) => {
                try {

                    const contactDetails: ContactDetail = {
                        FirstName: ctx.contactInfo.first_name!,
                        LastName: ctx.contactInfo.last_name!,
                        OrganizationName: ctx.contactInfo.organization_name,
                        AddressLine1: ctx.contactInfo.address_line_1!,
                        AddressLine2: ctx.contactInfo.address_line_2,
                        City: ctx.contactInfo.city!,
                        State: ctx.contactInfo.state!,
                        ZipCode: ctx.contactInfo.zip_code!,
                        CountryCode: ctx.contactInfo.country_code! as CountryCode,
                        Email: ctx.contactInfo.email_address!,
                        PhoneNumber: ctx.contactInfo.phone_number!,
                        ContactType: ctx.contactInfo.organization_name ? ContactType.COMPANY : ContactType.PERSON
                    };

                    // Create command to register the domain
                    const registerDomainCommand = new RegisterDomainCommand({
                        DomainName: domain,
                        AdminContact: contactDetails,
                        RegistrantContact: contactDetails,
                        TechContact: contactDetails,
                        AutoRenew: true,
                        PrivacyProtectAdminContact: true,
                        PrivacyProtectRegistrantContact: true,
                        PrivacyProtectTechContact: true,
                        DurationInYears: 1
                    });

                    // Send command to AWS
                    const { OperationId: opId } = await route53DomainsClient.send(registerDomainCommand);

                    if (!opId) {
                        throw new Error("Did not receive an OperationId from the registration request")
                    }

                    ctx.opId = opId

                } catch (error) {
                    if (error instanceof Error) {
                        if (error.message.includes("Account not found") || error.message.includes("not authorized")) {
                            task.output = context.logger.applyColors(
                                `If your AWS account is relatively new, purchasing a domain may fail with a vague error.\n` +
                                `AWS limits domain purchases for organizations that have not yet paid their first bill, but\n` +
                                `you can open a ticket requesting access and AWS support will unlock your account within 24 hours.\n\n` +
                                `For more information, visit: https://docs.aws.amazon.com/awssupport/latest/user/case-management.html\n\n` +
                                `If you'd like to proceed quicker, you can purchase a domain from an alternative DNS registrar such as\n` +
                                `https://www.namecheap.com/ as then re-run this command.`,
                                { style: "warning" }
                            )
                        }
                    }
                    throw error;
                }
            }
        }
    )

    //////////////////////////////////////////////////////////
    // Monitor Registration Status
    //////////////////////////////////////////////////////////
    tasks.add({
        title: "Get registration status",
        task: async (ctx, task) => {
            const maxAttempts = 100;
            let lastStatus: string | undefined;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const statusStr = lastStatus !== "" ? `${attempt}/${maxAttempts} - ${lastStatus}` : `${attempt}/${maxAttempts}`
                task.title = context.logger.applyColors(`Polling registration status ${statusStr}`, { lowlights: [statusStr] })
                let status, message, flag;
                try {
                    const response = await route53DomainsClient.send(
                        new GetOperationDetailCommand({ OperationId: ctx.opId! })
                    );
                    status = response.Status
                    message = response.Message
                    flag = response.StatusFlag
                } catch (e) {
                    throw new CLIError("Failed to get registration status", e)
                }

                // 1) Handle terminal statuses first:
                if (status === "SUCCESSFUL") {
                    task.title = context.logger.applyColors("Got registrtion status Success", { lowlights: ["Success"] })
                    return
                } else if (status === "FAILED" || status === "ERROR") {
                    // TODO: Better logging for users
                    task.title = context.logger.applyColors("Got registrtion status Failed", { style: "error", highlights: ["Failed"] })
                    throw new CLIError(`Registration failed: ${message || "unknown"}`);
                }

                // 2) If AWS is waiting on user, react or surface a clear instruction:
                if (flag) {
                    switch (flag) {
                        case "PENDING_ACCEPTANCE":
                            throw new CLIError("Domain transfer pending acceptance by the target AWS account.");

                        case "PENDING_CUSTOMER_ACTION":
                            task.output = context.logger.applyColors(
                                "AWS requires email verification to complete the registration. Check your inbox to confirm your email.",
                                { style: "warning" }
                            );
                            break;

                        case "PENDING_AUTHORIZATION":
                            await route53DomainsClient.send(
                                new ResendOperationAuthorizationCommand({ OperationId: ctx.opId })
                            );
                            break;

                        case "PENDING_PAYMENT_VERIFICATION":
                            task.output = context.logger.applyColors(
                                "AWS requires payment verification to complete the registration.  Please check your payment method in the AWS console.",
                                { style: "warning" }
                            );
                            break;

                        case "PENDING_SUPPORT_CASE":
                            throw new CLIError(
                                "Support case opened for this operation. Check AWS Support Center for the case status."
                            );

                        default:
                            throw new CLIError(
                                `Unexpected StatusFlag '${flag as string}'". Please consult the AWS console.`
                            );
                    }
                } else {
                    lastStatus = status
                }

                await new Promise((r) => globalThis.setTimeout(r, 15000));
            }

            throw new Error(
                `Timed out after ${maxAttempts} attempts waiting for operation to complete.`
            );
        }
    })

    //////////////////////////////////////////////////////////
    // Reset Route53 hosted zone
    //////////////////////////////////////////////////////////
    tasks.add({
        title: "Get Route53 hosted zone",
        task: async (ctx, task) => {
            // First, check if a hosted zone exists for this domain
            const listHostedZonesCommand = new ListHostedZonesByNameCommand({
                DNSName: domain,
                MaxItems: 1
            });

            let hostedZones: HostedZone[] = []
            try {
                const response = await route53Client.send(listHostedZonesCommand);
                hostedZones = response.HostedZones ?? []
            } catch (e) {
                throw new CLIError(`Failed to call ListHostedZonesByNameCommand`, e)
            }

            if (!hostedZones.length ||
                !hostedZones[0]?.Name?.startsWith(domain)) {
                task.title = context.logger.applyColors("Get Route53 hosted zone Not found", { lowlights: ["Not found"] })
                return;
            }

            const hostedZone = hostedZones[0];
            if (!hostedZone.Id) {
                throw new CLIError("Hosted zone found but missing ID");
            }

            // Fix the format of the id returned so it can be used in subsequent
            // API calls
            ctx.zoneId = hostedZone.Id.replace(/^\/hostedzone\//, '');
            task.title = context.logger.applyColors(`Get Route53 hosted zone ${ctx.zoneId}`, { lowlights: [ctx.zoneId] })
        }
    })

    //////////////////////////////////////////////////////////
    // Update Terragrunt Module
    //////////////////////////////////////////////////////////
    tasks.add(
        await buildDeployModuleTask<TaskContext>({
            context,
            module: MODULES.AWS_REGISTERED_DOMAINS,
            environment: env.name,
            region: GLOBAL_REGION,
            hclIfMissing: await Bun.file(moduleHCL).text(),
            imports: {
                [`aws_route53_zone.zones["${domain}"]`]: {
                    resourceId: async (ctx) => ctx.zoneId
                }
            },
            inputUpdates: {
                domain_names: defineInputUpdate({
                    update: (old) => {
                        const oldDomainSet = new Set(old)
                        oldDomainSet.add(domain)
                        return Array.from(oldDomainSet)
                    },
                    schema: z.array(z.string())
                }),
                admin_contact: defineInputUpdate({
                    schema: CONTACT_INFO_SCHEMA,
                    update: (old, ctx) => ({ ...old, ...ctx.contactInfo })
                }),
                registrant_contact: defineInputUpdate({
                    schema: CONTACT_INFO_SCHEMA,
                    update: (old, ctx) => ({ ...old, ...ctx.contactInfo })
                }),
                tech_contact: defineInputUpdate({
                    schema: CONTACT_INFO_SCHEMA,
                    update: (old, ctx) => ({ ...old, ...ctx.contactInfo })
                })
            }
        })
    )

    //////////////////////////////////////////////////////////
    // Run DNS Test
    //////////////////////////////////////////////////////////


    //////////////////////////////////////////////////////////
    // Get the modules outputs
    //////////////////////////////////////////////////////////
    tasks.add({
        title: "Get DNS zone metadata",
        task: async () => {
            const moduleOutput = await terragruntOutput({
                context,
                environment: env.name,
                region: GLOBAL_REGION,
                module: MODULES.AWS_REGISTERED_DOMAINS,
                validationSchema: REGISTERED_DOMAINS_MODULE_OUTPUT_SCHEMA,
            });

            const zoneInfo = moduleOutput.zones.value[domain]

            if (!zoneInfo) {
                throw new CLIError(`Could not find zone for ${domain} in module outputs`)
            }
            domainConfig.zoneId = zoneInfo.zone_id
            domainConfig.recordManagerRoleARN = moduleOutput.record_manager_role_arn.value
        }
    })

    ///////////////////////////////////////////////////////
    // Add to environment.yaml
    ///////////////////////////////////////////////////////
    tasks.add({
        title: "Update DevShell",
        task: async () => {

            const validatedDomainConfig = validateDomainConfig(domainConfig);
            await upsertConfigValues({
                context,
                filePath: join(env.path, "environment.yaml"),
                values: {
                    domains: {
                        [domain]: {
                            zone_id: validatedDomainConfig.zoneId,
                            record_manager_role_arn: validatedDomainConfig.recordManagerRoleARN
                        }
                    }
                }
            })
        }
    })

    ///////////////////////////////////////////////////////
    // Update clusters
    ///////////////////////////////////////////////////////
    // TODO: @jack - Update clusters

    //////////////////////////////////////////////////////////
    // Run the registration
    //////////////////////////////////////////////////////////
    context.logger.write(`Registering ${domain}...`)
    await runTasks({
        context,
        tasks,
        errorMessage: `Failed to register domain ${domain}`
    })
    context.logger.success(`${domain} registered in ${env.name} successfully!`)

    try {
        return validateDomainConfig(domainConfig)
    } catch (e) {
        if (e instanceof ZodError) {
            throw new PanfactumZodError("Failed to parse domain config", "registerDomain", e)
        } else {
            throw new CLIError("Failed to parse domain config", e)
        }
    }
}


/**
 * Retrieves primary contact information from AWS account using the Account API so that 
 * we can use it as defaults for the domain registration info (if needed)
 */
async function getPrimaryContactDefaults(profile: string, context: PanfactumContext): Promise<{
    fullName?: string;
    organizationName?: string;
    email?: string;
    phoneNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    countryCode?: string;
    zipCode?: string;
} | null> {
    try {
        const accountClient = await getAccountClient({ context, profile })

        // Create command to get contact information
        const getContactInfoCommand = new GetContactInformationCommand({});

        // Send the command to AWS
        const response = await accountClient.send(getContactInfoCommand);

        if (response.ContactInformation) {
            const contactInfo = response.ContactInformation;

            // Convert AWS contact format to our format
            return {
                fullName: contactInfo.FullName,
                organizationName: contactInfo.CompanyName,
                phoneNumber: contactInfo.PhoneNumber ? contactInfo.PhoneNumber.replace(/ /g, '.').replace(/-/g, '') : undefined, // Convert phone format
                addressLine1: contactInfo.AddressLine1,
                addressLine2: contactInfo.AddressLine2,
                city: contactInfo.City,
                state: contactInfo.StateOrRegion,
                countryCode: contactInfo.CountryCode,
                zipCode: contactInfo.PostalCode
            };
        }
    } catch (error) {
        // If we can't get the contact info, just log and continue
        context.logger.debug(
            `Could not retrieve primary contact information from AWS: ${error instanceof Error ? error.message : String(error)}`);
    }

    return null;
}