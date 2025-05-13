import path, { join } from "node:path";
import { cwd } from "node:process";
import { CoreApi, Configuration, type PaginatedGroupList, type User, type Link, type Token, IntentEnum, type PaginatedUserList, type PaginatedBrandList } from "@goauthentik/api";
import open from "open";
import { z } from "zod";
import authentikCoreResourcesHcl from "@/templates/authentk_core_resources.hcl" with { type: "file" };
import kubeSESDomainHcl from "@/templates/aws_ses_domain.hcl" with { type: "file" };
import kubeAuthentikHcl from "@/templates/kube_authentik.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import { writeFile } from "@/util/fs/writeFile";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { execute } from "@/util/subprocess/execute";
import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import type { PanfactumContext } from "@/util/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupAuthentik(
    context: PanfactumContext,
    mainTask: PanfactumTaskWrapper
) {
    const config = await getPanfactumConfig({
        context,
        directory: process.cwd(),
    });

    const {
        aws_profile: awsProfile,
        domains,
        environment,
        kube_config_context: kubeConfigContext,
        region,
    } = config;

    if (!environment || !region || !awsProfile) {
        throw new CLIError([
            "Cluster installation must be run from within a valid region-specific directory.",
            "If you do not have this file structure please ensure you've completed the initial setup steps here:",
            "https://panfactum.com/docs/edge/guides/bootstrapping/configuring-infrastructure-as-code#setting-up-your-repo",
        ]);
    }

    if (!kubeConfigContext) {
        throw new CLIError([
            "Kubernetes config context must be set in the configuration.",
        ]);
    }

    if (!domains) {
        throw new CLIError([
            "At least one domain must be available in the environment to install a cluster.",
            `Please run 'pf env add -e ${environment}' to add a domain to the environment.`,
        ]);
    }

    const environmentPath = path.join(
        context.repoVariables.environments_dir,
        environment
    );
    const clusterPath = path.join(environmentPath, region);


    const vaultSecretsFile = join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml")
    const vaultSecrets = await sopsDecrypt({
        filePath: vaultSecretsFile,
        context,
        validationSchema: z.object({
            root_token: z.string(),
        }),
    });

    if (vaultSecrets === null) {
        throw new CLIError(`Could not find vault token at ${vaultSecretsFile}`)
    }

    const { root_token: vaultRootToken } = vaultSecrets


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

                // FIX: @seth - You should NEVER read the module.yaml files directly.
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

                // FIX: @seth - You should NEVER read the module.yaml files directly.
                const originalAuthentikInputs = await readYAMLFile({
                    filePath: path.join(clusterPath, MODULES.KUBE_AUTHENTIK, "module.yaml"),
                    context,
                    validationSchema: z
                        .object({
                            adminEmail: z.string().optional(),
                            adminName: z.string().optional(),
                            extra_inputs: z
                                .object({
                                    akadmin_email: z.string().optional(),
                                    organization_name: z.string().optional(),
                                })
                                .passthrough()
                                .optional()
                                .default({}),
                        })
                        .passthrough(),
                });

                // FIX: @seth - You should NEVER read the module.yaml files directly.
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
                ctx.authentikAdminEmail = originalAuthentikInputs?.adminEmail;
                ctx.authentikAdminName = originalAuthentikInputs?.adminName;
                ctx.orgName = originalAuthentikInputs?.extra_inputs.organization_name;

                if (ctx.ancestorDomain && ctx.authentikAdminEmail && ctx.authentikRootEmail && ctx.authentikAdminName && ctx.orgName) {
                    task.skip("Already have Authentik configuration, skipping...");
                    return;
                }

                if (!originalAuthentikCoreResourcesInputs?.user_setup_complete) {
                    const notProd = !environment.includes("prod")
                    if (notProd) {
                        const confirmInstall = await context.logger.confirm({
                            task,
                            message: "Do you want to install Authentik?",
                            default: true,
                            explainer: "We recommend installing Authentik in the production environment."
                        });

                        if (!confirmInstall) {
                            throw new CLIError("User cancelled installation.");
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
                        // FIX: @seth - ??? adminEmail does NOT exist on the panfactum config schema
                        // await updateModuleYAMLFile({
                        //     context,
                        //     environment,
                        //     region,
                        //     module: MODULES.KUBE_AUTHENTIK,
                        //     rootUpdates: {
                        //         adminEmail: ctx.authentikAdminEmail
                        //     }
                        // })
                    }

                    if (!ctx.authentikAdminName) {
                        ctx.authentikAdminName = await context.logger.input({
                            task,
                            explainer: "This will be your name in Authentik.",
                            message: "Name:",
                            required: true,
                        })
                        // FIX: @seth - ??? adminName does NOT exist on the panfactum config schema
                        // await updateModuleYAMLFile({
                        //     context,
                        //     environment,
                        //     region,
                        //     module: MODULES.KUBE_AUTHENTIK,
                        //     rootUpdates: {
                        //         adminName: ctx.authentikAdminName
                        //     }
                        // })
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
            hclIfMissing: await Bun.file(kubeAuthentikHcl).text(),
            inputUpdates: {
                domain: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => `authentik.${ctx.ancestorDomain!}`
                }),
                akadmin_email: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.authentikAdminEmail!
                }),
                organization_name: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => ctx.orgName!
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
                // FIX: @seth - NEVER read to the config files directly
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

                // FIX: @seth - NEVER read to the config files directly
                if (await fileExists(path.join(context.repoVariables.environments_dir, "global.yaml"))) {
                    // FIX: @seth - NEVER read to the config files directly
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
                    // FIX: @seth - NEVER write to the config files directly
                    await writeYAMLFile({
                        context,
                        filePath: path.join(context.repoVariables.environments_dir, "global.yaml"),
                        values: newGlobalConfig,
                        overwrite: true,
                    })
                } else {
                    // FIX: @seth - NEVER write to the config files directly
                    await writeYAMLFile({
                        context,
                        filePath: path.join(context.repoVariables.environments_dir, "global.yaml"),
                        values: {
                            authentik_url: `https://authentik.${ctx.ancestorDomain}`
                        }
                    })
                }
            }
        },
        {
            title: "Deploy Authentik Core Resources",
            skip: async () => {
                const pfData = await getModuleStatus({ environment, region, module: MODULES.AUTHENTIK_CORE_RESOURCES, context });
                return pfData.deploy_status === "success";
            },
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

                // Disable reloader to prevent it from reloading the Authentik resources
                await execute({
                    command: [
                        "kubectl",
                        "annotate",
                        "deployment",
                        "authentik-server",
                        "-n",
                        "authentik",
                        'reloader.stakater.com/auto="false"',
                        "--context", kubeConfigContext,
                    ],
                    context,
                    workingDirectory: cwd(),
                })

                // FIX: @seth - We have a yaml stringifier??? Don't use raw string manipulation

                // Disable pod disruption on the Authentik cnpg cluster & Authentik server deployment
                const yaml = `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: all-cnpg-clusters-pdb
  namespace: authentik
spec:
  selector:
    matchExpressions:
      - key: cnpg.io/cluster
        operator: Exists
  minAvailable: "100%"
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: authentik-server-pdb
  namespace: authentik
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: server
      app.kubernetes.io/instance: authentik
      app.kubernetes.io/name: authentik
  minAvailable: "100%"`;

                // FIX: @seth - Use the stdin interface, don't write a temp file
                const tempFile = `temp-pdb-${Date.now()}.yaml`;
                await writeFile({ context, filePath: join(cwd(), tempFile), contents: yaml, overwrite: true })

                await execute({
                    command: [
                        "kubectl",
                        "apply",
                        "-f",
                        tempFile,
                        "--context", kubeConfigContext,
                    ],
                    context,
                    workingDirectory: cwd(),
                })
                const bunFile = Bun.file(tempFile)
                await bunFile.delete()

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
                        hclIfMissing: await Bun.file(authentikCoreResourcesHcl).text(),
                        inputUpdates: {
                            // TODO: this should be the root domain
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
            title: "Restarting Authentik",
            task: async () => {
                // Added the --ignore-not-found flag for resumability instead of doing more complex skip logic here
                await execute({
                    command: ["kubectl", "delete", "pdb", "authentik-server-pdb", "all-cnpg-clusters-pdb", "-n", "authentik", "--context", kubeConfigContext, "--ignore-not-found"],
                    context,
                    workingDirectory: cwd(),
                })
                await execute({
                    command: ["kubectl", "annotate", "deployment", "authentik-server", "-n", "authentik", "reloader.stakater.com/auto-", "--context", kubeConfigContext],
                    context,
                    workingDirectory: cwd(),
                })
                await execute({
                    command: [
                        "kubectl",
                        "rollout",
                        "restart", "deployment",
                        "authentik-server",
                        "-n",
                        "authentik",
                        "--context",
                        kubeConfigContext,
                    ],
                    context,
                    workingDirectory: cwd(),
                })
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
                let user: User | undefined
                try {
                    const users = await originalAuthentikClient.coreUsersList()
                    user = users.results.find(
                        (user) => user.username === ctx.authentikAdminEmail
                    );
                } catch (error) {
                    throw new CLIError("Failed to get users from Authentik", error);
                }
                if (!user) {
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
                }
                const userId = user.pk;

                // Check if there is an existing token
                let authentikUserToken: string | undefined
                const authentikSecretsPath = join(clusterPath, MODULES.AUTHENTIK_CORE_RESOURCES, "secrets.yaml")
                const data = await sopsDecrypt({
                    filePath: authentikSecretsPath,
                    context,
                    validationSchema: z.object({
                        authentikUserToken: z.string(),
                    })
                })
                if (data?.authentikUserToken) {
                    try {
                        const testAuthentikClient = new CoreApi(new Configuration({
                            basePath: `https://authentik.${ctx.ancestorDomain}/api/v3`,
                            headers: {
                                Authorization: `Bearer ${data.authentikUserToken}`,
                            }
                        }))
                        await testAuthentikClient.coreGroupsList()

                        // If the request succeeds we use the existing token
                        authentikUserToken = data.authentikUserToken
                    } catch {
                        // Do nothing we assume the token is invalid or expired
                    }
                }

                // Get a new token
                if (!authentikUserToken) {
                    // create the API token
                    let token: Token | undefined
                    const tokenIdentifier = "local-framework-token-" + Date.now()
                    try {
                        token = await originalAuthentikClient.coreTokensRetrieve({
                            identifier: tokenIdentifier,
                        })
                    } catch (error) {
                        throw new CLIError("Failed to get API token in Authentik", error);
                    }
                    if (!token) {
                        try {
                            token = await originalAuthentikClient.coreTokensCreate({
                                tokenRequest: {
                                    identifier: tokenIdentifier,
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
                    }

                    // We only need to get this the first time they run this command
                    if (!data?.authentikUserToken) {

                        let passwordReset: Link
                        try {
                            passwordReset = await originalAuthentikClient.coreUsersRecoveryCreate({
                                id: userId,
                            })
                        } catch (error) {
                            throw new CLIError("Failed to get password reset link in Authentik", error);
                        }
                        const passwordResetLink = passwordReset.link;


                        const openBrowser = await context.logger.confirm({
                            task,
                            explainer: "We will now open your browser so you can finish setting up your Authentik account.\nYou will need to enter your user email in the browser that opens.",
                            message: "Ready?",
                            default: true,
                        })

                        if (openBrowser) {
                            await open(passwordResetLink)
                        } else {
                            throw new CLIError("You must complete the account setup before continuing.")
                        }

                        const accountSetupComplete = await context.logger.confirm({
                            task,
                            message: "Have you setup your Authentik account?",
                            default: true,
                        })

                        if (!accountSetupComplete) {
                            const accountSetupCompleteAgain = await context.logger.confirm({
                                task,
                                message: "Have you setup your Authentik account? You must complete that before continuing.",
                                default: true,
                            });
                            if (!accountSetupCompleteAgain) {
                                throw new CLIError("You must complete the account setup before continuing.")
                            }
                        }
                    }

                    // replace bootstrap token with API token
                    authentikUserToken = await context.logger.password({
                        task,
                        explainer: `
                    We have created a new temporary API token to use                    
                    Go to https://authentik.${ctx.ancestorDomain}/if/user/#/settings;%7B%22page%22%3A%22page-tokens%22%7D
                    Look for the token with the identifier '${tokenIdentifier}'`,
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

                    await sopsUpsert({
                        filePath: join(clusterPath, MODULES.AUTHENTIK_CORE_RESOURCES, "secrets.yaml"),
                        context,
                        values: {
                            authentikUserToken,
                            tokenIdentifier
                        }
                    })
                }

                const newAuthentikClient = new CoreApi(new Configuration({
                    basePath: `https://authentik.${ctx.ancestorDomain}/api/v3`,
                    headers: {
                        Authorization: `Bearer ${authentikUserToken}`,
                    }
                }))

                // delete the bootstrap token
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-destroy
                try {
                    await originalAuthentikClient.coreTokensDestroy({
                        identifier: "authentik-bootstrap-token",
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
                    (user) => user.username === "akadmin"
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
                            username: "akadmin",
                            name: 'Authentik Root User',
                            isActive: false,
                        }
                    })
                } catch (error) {
                    throw new CLIError("Failed to disable bootstrap user in Authentik", error);
                }

                // FIX: @seth - ??? user_setup_complete is not a part of the panfactum schema????
                // await updateModuleYAMLFile({
                //     context,
                //     environment,
                //     region,
                //     module: MODULES.AUTHENTIK_CORE_RESOURCES,
                //     rootUpdates: {
                //         user_setup_complete: true
                //     }
                // })
            }
        }
    ])

    return tasks;
}
