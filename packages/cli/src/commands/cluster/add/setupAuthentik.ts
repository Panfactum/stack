import { appendFile } from "node:fs/promises";
import path, { join } from "node:path";
import { CoreApi, Configuration, type PaginatedGroupList, type User, type Link, type Token, IntentEnum, type PaginatedTokenList, type PaginatedUserList, type PaginatedBrandList } from "@goauthentik/api";
import { z } from "zod";
import authentikCoreResourcesHcl from "@/templates/authentk_core_resources.hcl" with { type: "file" };
import kubeSESDomainHcl from "@/templates/aws_ses_domain.hcl" with { type: "file" };
import kubeAuthentikHcl from "@/templates/kube_authentik.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { findFolder } from "@/util/fs/findFolder";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { updateModuleYAMLFile } from "@/util/yaml/updateModuleYAMLFile";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupAuthentik(
    options: InstallClusterStepOptions,
    mainTask: PanfactumTaskWrapper
) {
    const { awsProfile, context, domains, environment, clusterPath, region } =
        options;


    const { root_token: vaultRootToken } = await sopsDecrypt({
        filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
        context,
        validationSchema: z.object({
            root_token: z.string(),
        }),
    });


    interface Context {
        akadminBootstrapToken?: string;
        ancestorDomain?: string;
        authentikRootEmail?: string;
        authentikAdminEmail?: string;
        authentikAdminName?: string;
        orgName?: string;
    }

    const tasks = mainTask.newListr<Context>([
        {
            title: "Verify access",
            task: async () => {
                await getIdentity({ context, profile: awsProfile });
            },
        },
        {
            title: "Get Authentik User Configuration",
            task: async (ctx, task) => {
                // See if kube_authentik/terragrunt.hcl exist somewhere
                const repoRoot = context.repoVariables.repo_root
                let kubeAuthentikPath = null;
                try {
                    kubeAuthentikPath = await findFolder(repoRoot, "kube_authentik");
                } catch {
                    throw new CLIError("Errored while trying to find kube_authentik folder");
                }

                const originalSESInputs = await readYAMLFile({
                    filePath: path.join(clusterPath, MODULES.AWS_SES_DOMAIN, "module.yaml"),
                    context,
                    validationSchema: z
                        .object({
                            extra_inputs: z
                                .object({
                                    domain: z.string().optional(),
                                })
                                .passthrough()
                                .optional()
                                .default({}),
                        }).passthrough(),
                });



                const originalAuthentikInputs = await readYAMLFile({
                    filePath: path.join(clusterPath, MODULES.KUBE_AUTHENTIK, "module.yaml"),
                    context,
                    validationSchema: z
                        .object({
                            extra_inputs: z
                                .object({
                                    akadmin_email: z.string().optional(),
                                })
                                .passthrough()
                                .optional()
                                .default({}),
                        })
                        .passthrough(),
                });

                const originalAuthentikCoreResourcesInputs = await readYAMLFile({
                    filePath: path.join(clusterPath, MODULES.AUTHENTIK_CORE_RESOURCES, "module.yaml"),
                    context,
                    validationSchema: z
                        .object({
                            user_setup_complete: z.boolean().optional(),
                            extra_inputs: z
                                .object({
                                    organization_name: z.string().optional(),
                                })
                                .passthrough()
                                .optional()
                                .default({}),
                        })
                        .passthrough(),
                });

                ctx.ancestorDomain = originalSESInputs?.extra_inputs.domain;
                ctx.authentikRootEmail = originalAuthentikInputs?.extra_inputs.akadmin_email;
                ctx.orgName = originalAuthentikCoreResourcesInputs?.extra_inputs.organization_name;

                if (ctx.ancestorDomain && ctx.authentikAdminEmail && ctx.authentikRootEmail && ctx.authentikAdminName && ctx.orgName) {
                    task.skip("Already have Authentik configuration, skipping...");
                    return;
                }

                // TODO: @seth - Figure out this logic for resumes...
                if (!kubeAuthentikPath || !originalAuthentikCoreResourcesInputs?.user_setup_complete) {
                    const notProd = !environment.includes("prod")
                    const confirmInstall = await context.logger.confirm({
                        task,
                        message: "Do you want to install Authentik?",
                        default: true,
                        explainer: notProd ? "We recommend installing Authentik in the production environment." : undefined
                    });

                    // If they say no, rebuke and confirm
                    if (!confirmInstall) {
                        const confirmExit = await context.logger.confirm({
                            task,
                            message: "Are you sure you want to exit?",
                            explainer: { message: "We STRONGLY recommend completing this step if possible.", highlights: ["STRONGLY"] },
                            default: false,
                        });

                        // If they still say no, exit
                        if (confirmExit) {
                            throw new CLIError("Exiting...");
                        }
                    }

                    if (!ctx.ancestorDomain) {
                        ctx.ancestorDomain = await context.logger.select({
                            task,
                            explainer: {
                                message: `Which domain do you want to use for e-mails from Authentik?`,
                            },
                            message: "Environment domain:",
                            choices: Object.keys(domains).map(domain => ({ value: domain, name: domain })),
                        });
                    }

                    if (!ctx.authentikRootEmail) {
                        ctx.authentikRootEmail = await context.logger.input({
                            task,
                            explainer: "This email will be used for the initial Authentik root user.",
                            message: "Email:",
                            validate: (value: string) => {
                                const { error } = z.string().email().safeParse(value);
                                if (error) {
                                    return error.issues?.[0]?.message || "Please enter a valid email address";
                                }

                                return true;
                            }
                        })
                    }

                    if (!ctx.orgName) {
                        ctx.orgName = await context.logger.input({
                            task,
                            explainer: "This will be how your organization is referenced on the Authentik web UI.",
                            message: "Organization name:",
                        })
                    }

                    if (!ctx.authentikAdminEmail) {
                        ctx.authentikAdminEmail = await context.logger.input({
                            task,
                            explainer: "This email will be used for your Authentik user.",
                            message: "Email:",
                            validate: (value: string) => {
                                const { error } = z.string().email().safeParse(value);
                                if (error) {
                                    return error.issues?.[0]?.message || "Please enter a valid email address";
                                }

                                return true;
                            },
                            required: true
                        })
                    }

                    if (!ctx.authentikAdminName) {
                        ctx.authentikAdminName = await context.logger.input({
                            task,
                            explainer: "This will be your name in Authentik.",
                            message: "Name:",
                            required: true,
                        })
                    }
                }
            }
        },
        await buildDeployModuleTask<Context>({
            taskTitle: "Deploy AWS SES Domain",
            context,
            env: {
                ...context.env,
                VAULT_TOKEN: vaultRootToken
            },
            environment,
            region,
            module: MODULES.AWS_SES_DOMAIN,
            initModule: true,
            hclIfMissing: await Bun.file(kubeSESDomainHcl).text(),
            inputUpdates: {
                domain: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.ancestorDomain!
                })
            },
            skipIfAlreadyApplied: true,
        }),
        await buildDeployModuleTask<Context>({
            taskTitle: "Deploy Authentik",
            context,
            env: {
                ...context.env,
                VAULT_TOKEN: vaultRootToken
            },
            environment,
            region,
            module: MODULES.KUBE_AUTHENTIK,
            initModule: true,
            hclIfMissing: await Bun.file(kubeAuthentikHcl).text(),
            inputUpdates: {
                domain: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => `authentik.${ctx.ancestorDomain!}`
                }),
                akadmin_email: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.authentikAdminEmail!
                })
            },
            skipIfAlreadyApplied: true,
        }),
        {
            title: "Verify the Authentik Ingress",
            task: async (_, task) => {
                const moduleDir = join(
                    context.repoVariables.environments_dir,
                    environment,
                    region,
                    MODULES.KUBE_AUTHENTIK
                );
                const moduleYAMLPath = join(moduleDir, "module.yaml");
                const data = await readYAMLFile({
                    filePath: moduleYAMLPath,
                    context,
                    validationSchema: z.object({
                        extra_inputs: z.object({
                            domain: z.string(),
                        }),
                    }),
                    throwOnMissing: true,
                    throwOnEmpty: true,
                });

                if (!data?.extra_inputs.domain) {
                    throw new CLIError("Authentik domain not found in the module.yaml file");
                }

                task.output = context.logger.applyColors(`WARNING: This might take 10-30 minutes to complete while DNS propagates.`, { style: 'warning' })

                let attempts = 0;
                const maxAttempts = 60;
                const retryDelay = 30000;
                // Lower the DNS TTL to 5 seconds to speed up the DNS propagation
                // https://bun.sh/docs/api/dns#configuring-dns-cache-ttl
                process.env["BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS"] = "5";

                while (attempts < maxAttempts) {
                    try {
                        const statusStr = `attempt ${attempts + 1}/${maxAttempts}`
                        task.title = context.logger.applyColors(`Verifying the Authentik Ingress ${statusStr}`, { lowlights: [statusStr] });
                        const response = await Bun.fetch(`https://${data.extra_inputs.domain}/-/health/ready/`);
                        if (response.status === 200) {
                            task.title = context.logger.applyColors("Authentik ready check successful");
                            break;
                        }
                    } catch {
                        // Expected to error while waiting for DNS to propagate
                    }
                    attempts++;

                    if (attempts < maxAttempts) {
                        await new Promise(resolve => globalThis.setTimeout(resolve, retryDelay));
                    } else {
                        task.title = context.logger.applyColors(`Failed to connect to Authentik ready endpoint after ${maxAttempts} attempts`, { style: "error" });
                        throw new CLIError(`Failed to connect to Authentik ready endpoint after ${maxAttempts} attempts`);
                    }
                }
            },
            rendererOptions: {
                outputBar: 5,
            },
        },
        {
            skip: async () => {
                const originalGlobalConfig = await readYAMLFile({
                    filePath: path.join(context.repoVariables.environments_dir, "global.yaml"),
                    context,
                    validationSchema: z.object({
                        authentik_url: z.string().optional(),
                    }).passthrough(),
                })
                return !!originalGlobalConfig?.authentik_url
            },
            title: "Disabling default Authentik resources",
            task: async (ctx) => {
                const outputs = await terragruntOutput({
                    context,
                    environment,
                    region,
                    env: {
                        ...context.env,
                        VAULT_TOKEN: vaultRootToken
                    },
                    module: MODULES.KUBE_AUTHENTIK,
                    validationSchema: z.record(
                        z.string(),
                        z.object({
                            sensitive: z.boolean(),
                            type: z.string(),
                            value: z.string(),
                        })
                    )
                })

                ctx.akadminBootstrapToken = outputs["akadmin_bootstrap_token"]?.value

                if (!ctx.akadminBootstrapToken) {
                    throw new CLIError("akadmin_bootstrap_token not found in Authentik module outputs")
                }

                const configuration = new Configuration({
                    basePath: `https://authentik.${ctx.ancestorDomain}/api/v3`,
                    headers: {
                        Authorization: `Bearer ${ctx.akadminBootstrapToken}`,
                    }
                })

                const authentikClient = new CoreApi(configuration)

                let brands: PaginatedBrandList
                try {
                    brands = await authentikClient.coreBrandsList()
                } catch (error) {
                    throw new CLIError("Failed to get brands from Authentik", error);
                }

                const authentikDefaultBrand = brands.results.find(
                    (brand) => brand.domain === "authentik-default"
                );
                if (authentikDefaultBrand) {
                    try {
                        await authentikClient.coreBrandsUpdate({
                            brandUuid: authentikDefaultBrand.brandUuid,
                            brandRequest: {
                                domain: authentikDefaultBrand.domain,
                                _default: false,
                            }
                        })
                    } catch (error) {
                        throw new CLIError("Failed to update default brand in Authentik", error);
                    }
                }

                if (await fileExists(path.join(context.repoVariables.environments_dir, "global.yaml"))) {
                    const originalGlobalConfig = await readYAMLFile({
                        filePath: path.join(context.repoVariables.environments_dir, "global.yaml"),
                        context,
                        validationSchema: z.object({
                            authentik_url: z.string().optional(),
                        }).passthrough(),
                    })
                    const newGlobalConfig = {
                        ...originalGlobalConfig,
                        authentik_url: `https://authentik.${ctx.ancestorDomain}`
                    }
                    await writeYAMLFile({
                        context,
                        path: path.join(context.repoVariables.environments_dir, "global.yaml"),
                        contents: newGlobalConfig,
                        overwrite: true,
                    })
                } else {
                    await writeYAMLFile({
                        context,
                        path: path.join(context.repoVariables.environments_dir, "global.yaml"),
                        contents: {
                            authentik_url: `https://authentik.${ctx.ancestorDomain}`
                        }
                    })
                }
            }
        },
        {
            title: "Deploy Authentik Core Resources",
            task: async (ctx, parentTask) => {
                if (!ctx.akadminBootstrapToken) {
                    const outputs = await terragruntOutput({
                        context,
                        environment,
                        region,
                        env: {
                            ...context.env,
                            VAULT_TOKEN: vaultRootToken
                        },
                        module: MODULES.KUBE_AUTHENTIK,
                        validationSchema: z.record(
                            z.string(),
                            z.object({
                                sensitive: z.boolean(),
                                type: z.string(),
                                value: z.string(),
                            })
                        )
                    })

                    ctx.akadminBootstrapToken = outputs["akadmin_bootstrap_token"]?.value

                    if (!ctx.akadminBootstrapToken) {
                        throw new CLIError("akadmin_bootstrap_token not found in Authentik module outputs")
                    }
                }
                if (!ctx.orgName) {
                    throw new CLIError("orgName not found in Authentik context")
                }
                if (!ctx.ancestorDomain) {
                    throw new CLIError("ancestorDomain not found in Authentik context")
                }
                return parentTask.newListr([
                    await buildDeployModuleTask<Context>({
                        taskTitle: "Deploy Authentik Core Resources",
                        context,
                        environment,
                        region,
                        env: {
                            ...context.env,
                            AUTHENTIK_TOKEN: ctx.akadminBootstrapToken,
                            VAULT_TOKEN: vaultRootToken,
                        },
                        skipIfAlreadyApplied: true,
                        module: MODULES.AUTHENTIK_CORE_RESOURCES,
                        initModule: true,
                        hclIfMissing: await Bun.file(authentikCoreResourcesHcl).text(),
                        inputUpdates: {
                            organization_name: defineInputUpdate({
                                schema: z.string(),
                                update: (_, ctx) => ctx.orgName!
                            }),
                            organization_domain: defineInputUpdate({
                                schema: z.string(),
                                update: (_, ctx) => ctx.ancestorDomain!
                            })
                        },
                    }),
                ], { ctx })
            }
        },
        {
            title: "Setting up your Authentik user account",
            task: async (ctx, task) => {
                if (!ctx.akadminBootstrapToken) {
                    const outputs = await terragruntOutput({
                        context,
                        environment,
                        region,
                        env: {
                            ...context.env,
                            VAULT_TOKEN: vaultRootToken
                        },
                        module: MODULES.KUBE_AUTHENTIK,
                        validationSchema: z.record(
                            z.string(),
                            z.object({
                                sensitive: z.boolean(),
                                type: z.string(),
                                value: z.string(),
                            })
                        )
                    })

                    ctx.akadminBootstrapToken = outputs["akadmin_bootstrap_token"]?.value

                    if (!ctx.akadminBootstrapToken) {
                        throw new CLIError("akadmin_bootstrap_token not found in Authentik module outputs")
                    }
                }

                if (!ctx.authentikAdminEmail || !ctx.authentikAdminName || !ctx.authentikRootEmail) {
                    throw new CLIError("Authentik admin email or name not found");
                }

                const originalAuthentikClient = new CoreApi(new Configuration({
                    basePath: `https://authentik.${ctx.ancestorDomain}/api/v3`,
                    headers: {
                        Authorization: `Bearer ${ctx.akadminBootstrapToken}`,
                    }
                }))

                // get superusers group uuid
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-groups-list
                let groups: PaginatedGroupList
                try {
                    groups = await originalAuthentikClient.coreGroupsList()
                } catch (error) {
                    throw new CLIError("Failed to get groups in Authentik", error);
                }
                const superusersGroup = groups.results.find(
                    (group) => group.name === "superusers"
                );
                if (!superusersGroup) {
                    throw new Error("Superusers group not found in Authentik");
                }
                const superusersGroupUuid = superusersGroup.pk;

                // create the user via API
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-create
                let user: User
                try {
                    user = await originalAuthentikClient.coreUsersCreate({
                        userRequest: {
                            username: ctx.authentikAdminEmail,
                            name: ctx.authentikAdminName,
                            email: ctx.authentikAdminEmail,
                            isActive: true,
                            groups: [superusersGroupUuid],
                            path: "users",
                            type: "internal",
                        }
                    })
                } catch (error) {
                    throw new CLIError("Failed to create user in Authentik", error);
                }
                const userId = user.pk;

                // get the password reset link and provide it to the user
                let passwordReset: Link
                try {
                    passwordReset = await originalAuthentikClient.coreUsersRecoveryCreate({
                        id: userId,
                    })
                } catch (error) {
                    throw new CLIError("Failed to get password reset link in Authentik", error);
                }
                const passwordResetLink = passwordReset.link;

                // create the API token
                let token: Token
                try {
                    token = await originalAuthentikClient.coreTokensCreate({
                        tokenRequest: {
                            identifier: "local-framework-token",
                            intent: IntentEnum.Api,
                            user: userId,
                            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                            expiring: true,
                            description:
                                "Created while running the Panfactum CLI and used to interact with Authentik from the local machine.",
                        }
                    })
                } catch (error) {
                    throw new CLIError("Failed to create API token in Authentik", error);
                }
                const userTokenPk = token.pk;

                const accountSetupComplete = await context.logger.confirm({
                    task,
                    explainer: `
                    Go ahead and setup your Authentikaccount
                    When you're done don't exit the web browser
                    We will need some info to continue
                    Use this link to setup your account:
                    ${passwordResetLink}
                    `,
                    message: "Have you setup your Authentik account?",
                    default: true,
                })

                if (!accountSetupComplete) {
                    const accountSetupCompleteAgain = await context.logger.confirm({
                        task,
                        message: "Have you setup your Authentik account?\nYou must complete that before continuing.",
                        default: true,
                    });
                    if (!accountSetupCompleteAgain) {
                        throw new CLIError("You must complete the account setup before continuing.")
                    }
                }

                // replace bootstrap token with API token
                const newToken = await context.logger.password({
                    task,
                    explainer: `
                    We have created a new temporary API token to use                    
                    Go to https://authentik.${ctx.ancestorDomain}/if/user/#/settings;%7B%22page%22%3A%22page-tokens%22%7D
                    Look for the token with the identifier 'local-framework-token'`,
                    message: "Copy the token and paste it here:",
                    validate: async (value) => {
                        try {
                            const response = await Bun.fetch(
                                `https://authentik.${ctx.ancestorDomain}/api/v3/core/groups/`,
                                {
                                    headers: {
                                        Authorization: `Bearer ${value}`,
                                    },
                                }
                            );
                            if (response.status !== 200) {
                                return "This does not appear to be a valid Authentik Access Token. Please try again.";
                            }
                            return true;
                        } catch {
                            return "Error validating Authentik Access Token, please try again.";
                        }
                    },
                });

                // Add AUTHENTIK_TOKEN to .env file
                const envFilePath = `${context.repoVariables.repo_root}/.env`;
                if (await fileExists(envFilePath)) {
                    await appendFile(envFilePath, `AUTHENTIK_TOKEN=${newToken}\n`);
                } else {
                    await Bun.write(envFilePath, `AUTHENTIK_TOKEN=${newToken}\n`);
                }

                const newAuthentikClient = new CoreApi(new Configuration({
                    basePath: `https://authentik.${ctx.ancestorDomain}/api/v3`,
                    headers: {
                        Authorization: `Bearer ${newToken}`,
                    }
                }))

                // get all the tokens
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-list
                let tokens: PaginatedTokenList
                try {
                    tokens = await newAuthentikClient.coreTokensList()
                } catch (error) {
                    throw new CLIError("Failed to get tokens from Authentik", error);
                }
                const bootstrapToken = tokens.results.filter(
                    (token) => token.pk !== userTokenPk
                );
                if (bootstrapToken.length !== 1) {
                    throw new Error("Bootstrap token not found in Authentik");
                }
                const bootstrapTokenUuid = bootstrapToken[0]!.pk;

                // delete the bootstrap token
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-destroy
                try {
                    await newAuthentikClient.coreTokensDestroy({
                        identifier: bootstrapTokenUuid,
                    })
                } catch (error) {
                    throw new CLIError("Failed to delete bootstrap token in Authentik", error);
                }

                // get all the users
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-list
                let users: PaginatedUserList
                try {
                    users = await newAuthentikClient.coreUsersList()
                } catch (error) {
                    throw new CLIError("Failed to get users from Authentik", error);
                }
                const bootstrapUser = users.results.find(
                    (user) => user.username === ctx.authentikRootEmail
                );
                if (!bootstrapUser) {
                    throw new Error("Bootstrap user not found in Authentik");
                }
                const bootstrapUserUuid = bootstrapUser.pk;

                // disable the bootstrap user
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-update
                try {
                    await newAuthentikClient.coreUsersUpdate({
                        id: bootstrapUserUuid,
                        userRequest: {
                            username: ctx.authentikRootEmail,
                            name: 'Authentik Root User',
                            isActive: false,
                        }
                    })
                } catch (error) {
                    throw new CLIError("Failed to disable bootstrap user in Authentik", error);
                }

                await updateModuleYAMLFile({
                    context,
                    environment,
                    region,
                    module: MODULES.AUTHENTIK_CORE_RESOURCES,
                    inputUpdates: {
                        user_setup_complete: true
                    }
                })
            }
        }
    ])

    return tasks;
}
