import { randomBytes } from "node:crypto";
import path, { join } from "node:path";
import { cwd } from "node:process";
import { CoreApi, Configuration, type User, IntentEnum } from "@goauthentik/api";
import { z } from "zod";
import authentikCoreResourcesHcl from "@/templates/authentk_core_resources.hcl" with { type: "file" };
import kubeSESDomainHcl from "@/templates/aws_ses_domain.hcl" with { type: "file" };
import kubeAuthentikHcl from "@/templates/kube_authentik.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { GLOBAL_USER_CONFIG } from "@/util/config/constants";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { SSO_SUBDOMAIN } from "@/util/domains/consts";
import { CLIError, CLISubprocessError } from "@/util/error/error";
import { writeFile } from "@/util/fs/writeFile";
import { getAuthentikBootstrapToken } from "@/util/sso/getAuthentikBootstrapToken";
import { MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { sleep } from "@/util/util/sleep";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { upsertPFYAMLFile } from "@/util/yaml/upsertPFYAMLFile";

import type { PanfactumContext } from "@/util/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

/**
 * Interface for setupAuthentik function inputs
 */
interface ISetupAuthentikInput {
    /** Panfactum context for logging and configuration */
    context: PanfactumContext;
    /** Listr task wrapper for managing subtasks */
    mainTask: PanfactumTaskWrapper;
    /** Path to the region directory where Authentik will be deployed */
    regionPath: string;
}

/**
 * Sets up Authentik SSO infrastructure in a Panfactum environment
 * 
 * @remarks
 * This function orchestrates the complete Authentik deployment including:
 * - AWS SES domain configuration for email notifications
 * - Authentik core service deployment
 * - Initial user and admin setup
 * - SSL certificate configuration
 * 
 * The process involves multiple Terragrunt modules and requires user
 * interaction to complete the initial Authentik configuration through
 * the web interface.
 * 
 * @param input - Configuration for Authentik setup
 * @throws {@link CLIError}
 * Throws when region path is invalid or required configuration is missing
 * 
 * @throws {@link CLIError}
 * Throws when Terragrunt deployments fail
 */
export async function setupAuthentik(input: ISetupAuthentikInput) {
    const { context, mainTask, regionPath } = input;
    const config = await getPanfactumConfig({
        context,
        directory: regionPath,
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
        context.devshellConfig.environments_dir,
        environment
    );
    const clusterPath = path.join(environmentPath, region);


    interface IContext {
        ancestorDomain?: string;
        authentikAdminEmail?: string;
        authentikAdminName?: string;
        orgName?: string;
    }

    const tasks = mainTask.newListr<IContext>([
        {
            title: "Verify access",
            task: async () => {
                await getIdentity({ context, profile: awsProfile });
            },
        },
        {
            title: "Get Authentik User Configuration",
            task: async (ctx, task) => {

                const [sesModuleConfig, authentikModuleConfig] = await Promise.all([
                    getPanfactumConfig({ context, directory: path.join(clusterPath, MODULES.AWS_SES_DOMAIN) }),
                    getPanfactumConfig({ context, directory: path.join(clusterPath, MODULES.KUBE_AUTHENTIK) }),
                ]);

                const authentikCoreResourcesPfYAMLFileData = await readYAMLFile({
                    filePath: path.join(clusterPath, MODULES.AUTHENTIK_CORE_RESOURCES, ".pf.yaml"),
                    context,
                    throwOnMissing: false,
                    validationSchema: z
                        .object({
                            user_setup_complete: z.boolean().optional(),
                        })
                        .passthrough(),
                })

                const kubeAuthentikPfYAMLFileData = await readYAMLFile({
                    filePath: path.join(clusterPath, MODULES.KUBE_AUTHENTIK, ".pf.yaml"),
                    context,
                    throwOnMissing: false,
                    validationSchema: z
                        .object({
                            adminEmail: z.string().optional(),
                            adminName: z.string().optional(),
                        })
                        .passthrough(),
                });


                ctx.ancestorDomain = sesModuleConfig.extra_inputs?.['domain'] as string | undefined;
                ctx.authentikAdminEmail = kubeAuthentikPfYAMLFileData?.adminEmail;
                ctx.authentikAdminName = kubeAuthentikPfYAMLFileData?.adminName;
                ctx.orgName = authentikModuleConfig.extra_inputs?.['organization_name'] as string | undefined;

                if (ctx.ancestorDomain && ctx.authentikAdminEmail && ctx.authentikAdminName && ctx.orgName) {
                    task.skip("Already have Authentik configuration, skipping...");
                    return;
                }

                if (!authentikCoreResourcesPfYAMLFileData?.user_setup_complete) {
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
                                message: `Which domain would you like to use for SSO?`,
                            },
                            message: "Environment domain:",
                            choices: Object.keys(domains).map(domain => ({ value: domain, name: `${SSO_SUBDOMAIN}.${domain}` })),
                        });
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
                            explainer: "This email will be used for your Authentik user. This email must be unique and not be the AWS root email address.",
                            message: "Email:",
                            validate: (value: string) => {
                                const { error } = z.string().email().safeParse(value);
                                if (error) {
                                    return error.issues[0]?.message || "Please enter a valid email address";
                                }

                                return true;
                            },
                            required: true
                        })

                        await upsertPFYAMLFile({
                            context,
                            environment,
                            region,
                            module: MODULES.KUBE_AUTHENTIK,
                            updates: {
                                adminEmail: ctx.authentikAdminEmail
                            }
                        })
                    }

                    if (!ctx.authentikAdminName) {
                        ctx.authentikAdminName = await context.logger.input({
                            task,
                            explainer: "This will be your name in Authentik.",
                            message: "Name:",
                            required: true,
                        })

                        await upsertPFYAMLFile({
                            context,
                            environment,
                            region,
                            module: MODULES.KUBE_AUTHENTIK,
                            updates: {
                                adminName: ctx.authentikAdminName
                            }
                        })
                    }
                }
            }
        },
        await buildDeployModuleTask<IContext>({
            taskTitle: "Deploy AWS SES Domain",
            context,
            env: {
                ...context.env,
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
        await buildDeployModuleTask<IContext>({
            taskTitle: "Deploy Authentik",
            context,
            env: {
                ...context.env,
            },
            environment,
            region,
            module: MODULES.KUBE_AUTHENTIK,
            hclIfMissing: await Bun.file(kubeAuthentikHcl).text(),
            inputUpdates: {
                domain: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => `${SSO_SUBDOMAIN}.${ctx.ancestorDomain!}`
                }),
                akadmin_email: defineInputUpdate({
                    schema: z.string(),
                    update: (_, ctx) => `akadmin@${SSO_SUBDOMAIN}.${ctx.ancestorDomain!}`
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
                if (!config.authentik_token) {
                    config.authentik_token = await getAuthentikBootstrapToken({
                        context,
                        environment,
                        region,
                        env: { ...context.env },
                    });
                }


                const moduleDir = join(
                    context.devshellConfig.environments_dir,
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
                    const statusStr = `attempt ${attempts + 1}/${maxAttempts}`
                    task.title = context.logger.applyColors(`Verifying the Authentik Ingress ${statusStr}`, { lowlights: [statusStr] });
                    const response = await fetch(`https://${data.extra_inputs.domain}/-/health/ready/`).catch(() => null);
                    if (response?.status === 200) {
                        task.title = context.logger.applyColors("Authentik ready check successful");
                        break;
                    }
                    // Expected to error while waiting for DNS to propagate
                    attempts++;

                    if (attempts < maxAttempts) {
                        await sleep(retryDelay);
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
            skip: () => !!config.authentik_url,
            title: "Disabling default Authentik resources",
            task: async (ctx) => {
                if (!config.authentik_token) {
                    config.authentik_token = await getAuthentikBootstrapToken({
                        context,
                        environment,
                        region,
                        env: { ...context.env },
                    });
                }

                const configuration = new Configuration({
                    basePath: `https://${SSO_SUBDOMAIN}.${ctx.ancestorDomain}/api/v3`,
                    headers: {
                        Authorization: `Bearer ${config.authentik_token}`,
                    }
                })

                const authentikClient = new CoreApi(configuration)

                const brands = await authentikClient.coreBrandsList().catch((error: unknown) => {
                    throw new CLIError("Failed to get brands from Authentik", error);
                })

                const authentikDefaultBrand = brands.results.find(
                    (brand) => brand.domain === "authentik-default"
                );
                if (authentikDefaultBrand) {
                    await authentikClient.coreBrandsUpdate({
                        brandUuid: authentikDefaultBrand.brandUuid,
                        brandRequest: {
                            domain: authentikDefaultBrand.domain,
                            _default: false,
                        }
                    }).catch((error: unknown) => {
                        throw new CLIError("Failed to update default brand in Authentik", error);
                    })
                }

                await upsertConfigValues({
                    context,
                    values: { authentik_url: `https://${SSO_SUBDOMAIN}.${ctx.ancestorDomain}` },
                })
            }
        },
        {
            title: "Deploy Authentik Core Resources",
            skip: async () => {
                const pfData = await getModuleStatus({ environment, region, module: MODULES.AUTHENTIK_CORE_RESOURCES, context });
                return pfData.deploy_status === "success";
            },
            task: async (ctx, parentTask) => {
                if (!config.authentik_token) {
                    config.authentik_token = await getAuthentikBootstrapToken({
                        context,
                        environment,
                        region,
                        env: { ...context.env },
                    });
                }
                if (!ctx.orgName) {
                    throw new CLIError("orgName not found in Authentik context")
                }
                if (!ctx.ancestorDomain) {
                    throw new CLIError("ancestorDomain not found in Authentik context")
                }

                // Disable reloader to prevent it from reloading the Authentik resources
                const disableReloaderCommand = [
                    "kubectl",
                    "annotate",
                    "deployment",
                    "authentik-server",
                    "-n",
                    "authentik",
                    'reloader.stakater.com/auto="false"',
                    "--context", kubeConfigContext,
                ]
                const disableReloaderResult = await context.subprocessManager.execute({
                    command: disableReloaderCommand,
                    workingDirectory: cwd(),
                }).exited

                if (disableReloaderResult.exitCode !== 0) {
                    throw new CLISubprocessError(
                        "Failed to disable reloader on authentik-server deployment",
                        {
                            command: disableReloaderCommand.join(' '),
                            subprocessLogs: disableReloaderResult.output,
                            workingDirectory: cwd(),
                        }
                    )
                }

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

                const applyPdbCommand = [
                    "kubectl",
                    "apply",
                    "-f",
                    tempFile,
                    "--context", kubeConfigContext,
                ]
                const applyPdbResult = await context.subprocessManager.execute({
                    command: applyPdbCommand,
                    workingDirectory: cwd(),
                }).exited
                const bunFile = Bun.file(tempFile)
                await bunFile.delete()

                if (applyPdbResult.exitCode !== 0) {
                    throw new CLISubprocessError(
                        "Failed to apply Authentik PodDisruptionBudgets",
                        {
                            command: applyPdbCommand.join(' '),
                            subprocessLogs: applyPdbResult.output,
                            workingDirectory: cwd(),
                        }
                    )
                }

                return parentTask.newListr([
                    await buildDeployModuleTask<IContext>({
                        taskTitle: "Deploy Authentik Core Resources",
                        context,
                        environment,
                        region,
                        env: {
                            ...context.env,
                            AUTHENTIK_TOKEN: config.authentik_token,
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
            task: async (_ctx, task) => {
                task.title = context.logger.applyColors("Restarting Authentik Deleting PodDisruptionBudgets", { lowlights: ["Deleting PodDisruptionBudgets"] })
                // Added the --ignore-not-found flag for resumability instead of doing more complex skip logic here
                const deletePdbCommand = ["kubectl", "delete", "pdb", "authentik-server-pdb", "all-cnpg-clusters-pdb", "-n", "authentik", "--context", kubeConfigContext, "--ignore-not-found"]
                const deletePdbResult = await context.subprocessManager.execute({
                    command: deletePdbCommand,
                    workingDirectory: cwd(),
                }).exited

                if (deletePdbResult.exitCode !== 0) {
                    throw new CLISubprocessError(
                        "Failed to delete Authentik PodDisruptionBudgets",
                        {
                            command: deletePdbCommand.join(' '),
                            subprocessLogs: deletePdbResult.output,
                            workingDirectory: cwd(),
                        }
                    )
                }

                task.title = context.logger.applyColors("Restarting Authentik Removing reloader annotation", { lowlights: ["Removing reloader annotation"] })
                const removeAnnotationCommand = ["kubectl", "annotate", "deployment", "authentik-server", "-n", "authentik", "reloader.stakater.com/auto-", "--context", kubeConfigContext]
                const removeAnnotationResult = await context.subprocessManager.execute({
                    command: removeAnnotationCommand,
                    workingDirectory: cwd(),
                }).exited

                if (removeAnnotationResult.exitCode !== 0) {
                    throw new CLISubprocessError(
                        "Failed to remove reloader annotation from authentik-server deployment",
                        {
                            command: removeAnnotationCommand.join(' '),
                            subprocessLogs: removeAnnotationResult.output,
                            workingDirectory: cwd(),
                        }
                    )
                }

                task.title = context.logger.applyColors("Restarting Authentik Triggering rollout", { lowlights: ["Triggering rollout"] })
                const restartCommand = [
                    "kubectl",
                    "rollout",
                    "restart", "deployment",
                    "authentik-server",
                    "-n",
                    "authentik",
                    "--context",
                    kubeConfigContext,
                ]
                const restartResult = await context.subprocessManager.execute({
                    command: restartCommand,
                    workingDirectory: cwd(),
                }).exited

                if (restartResult.exitCode !== 0) {
                    throw new CLISubprocessError(
                        "Failed to restart authentik-server deployment",
                        {
                            command: restartCommand.join(' '),
                            subprocessLogs: restartResult.output,
                            workingDirectory: cwd(),
                        }
                    )
                }

                task.title = context.logger.applyColors("Restarting Authentik Waiting for pods to be ready", { lowlights: ["Waiting for pods to be ready"] })
                const rolloutStatusCommand = [
                    "kubectl",
                    "rollout",
                    "status",
                    "deployment/authentik-server",
                    "-n",
                    "authentik",
                    "--context", kubeConfigContext,
                    "--timeout=10m",
                ]
                const rolloutStatusResult = await context.subprocessManager.execute({
                    command: rolloutStatusCommand,
                    workingDirectory: cwd(),
                }).exited

                if (rolloutStatusResult.exitCode !== 0) {
                    throw new CLISubprocessError(
                        "Authentik deployment did not become ready after restart",
                        {
                            command: rolloutStatusCommand.join(' '),
                            subprocessLogs: rolloutStatusResult.output,
                            workingDirectory: cwd(),
                        }
                    )
                }

                task.title = "Restarted Authentik"
            }
        },
        {
            title: "Setting up your Authentik user account",
            task: async (ctx, _task) => {
                if (!config.authentik_token) {
                    config.authentik_token = await getAuthentikBootstrapToken({
                        context,
                        environment,
                        region,
                        env: { ...context.env },
                    });
                }

                if (!ctx.authentikAdminEmail || !ctx.authentikAdminName) {
                    throw new CLIError("Authentik admin email or name not found");
                }

                const originalAuthentikClient = new CoreApi(new Configuration({
                    basePath: `https://${SSO_SUBDOMAIN}.${ctx.ancestorDomain}/api/v3`,
                    headers: {
                        Authorization: `Bearer ${config.authentik_token}`,
                    }
                }))

                // get superusers group uuid
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-groups-list
                const groups = await originalAuthentikClient.coreGroupsList().catch((error: unknown) => {
                    throw new CLIError("Failed to get groups in Authentik", error);
                })
                const superusersGroup = groups.results.find(
                    (group) => group.name === "superusers"
                );
                if (!superusersGroup) {
                    throw new CLIError("Superusers group not found in Authentik");
                }
                const superusersGroupUuid = superusersGroup.pk;

                // create the user via API
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-create
                let user: User | undefined
                const existingUsers = await originalAuthentikClient.coreUsersList().catch((error: unknown) => {
                    throw new CLIError("Failed to get users from Authentik", error);
                })
                user = existingUsers.results.find(
                    (user) => user.username === ctx.authentikAdminEmail
                );

                if (!user) {
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
                    }).catch((error: unknown) => {
                        throw new CLIError("Failed to create user in Authentik", error);
                    })
                }
                const userId = user.pk;

                // Generate a secure password and set it via API
                const generatedPassword = randomBytes(32).toString("hex");
                await originalAuthentikClient.coreUsersSetPasswordCreate({
                    id: userId,
                    userPasswordSetRequest: {
                        password: generatedPassword,
                    }
                }).catch((error: unknown) => {
                    throw new CLIError("Failed to set password for Authentik user", error);
                })

                // Rotate the installer API token: delete if exists, then always create fresh
                const tokenIdentifier = "local-pf-installer-token"
                const existingTokens = await originalAuthentikClient.coreTokensList({
                    identifier: tokenIdentifier,
                }).catch((error: unknown) => {
                    throw new CLIError("Failed to list API tokens in Authentik", error);
                })
                if (existingTokens.results.length > 0) {
                    await originalAuthentikClient.coreTokensDestroy({
                        identifier: tokenIdentifier,
                    }).catch((error: unknown) => {
                        throw new CLIError("Failed to delete existing installer token in Authentik", error);
                    })
                }
                await originalAuthentikClient.coreTokensCreate({
                    tokenRequest: {
                        identifier: tokenIdentifier,
                        intent: IntentEnum.Api,
                        user: userId,
                        expiring: false,
                        description:
                            "Created by the Panfactum CLI installer and used to interact with Authentik from the local machine.",
                    }
                }).catch((error: unknown) => {
                    throw new CLIError("Failed to create API token in Authentik", error);
                })

                // Retrieve the plaintext token value
                const tokenView = await originalAuthentikClient.coreTokensViewKeyRetrieve({
                    identifier: tokenIdentifier,
                }).catch((error: unknown) => {
                    throw new CLIError("Failed to retrieve API token key from Authentik", error);
                })
                const authentikUserToken = tokenView.key;

                // Store the token in global.user.yaml (gitignored, user-local)
                await upsertConfigValues({
                    context,
                    filePath: join(context.devshellConfig.environments_dir, GLOBAL_USER_CONFIG),
                    values: {
                        authentik_token: authentikUserToken,
                    }
                })

                // Build a new client using the user token
                const newAuthentikClient = new CoreApi(new Configuration({
                    basePath: `https://${SSO_SUBDOMAIN}.${ctx.ancestorDomain}/api/v3`,
                    headers: {
                        Authorization: `Bearer ${authentikUserToken}`,
                    }
                }))

                // Verify the new token works before deleting the bootstrap token
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-list
                const allUsers = await newAuthentikClient.coreUsersList().catch((error: unknown) => {
                    throw new CLIError("Failed to verify new Authentik token — user list request failed", error);
                })

                // delete the bootstrap token now that the new token is confirmed working
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-list
                // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-destroy
                const bootstrapTokens = await originalAuthentikClient.coreTokensList({
                    identifier: "authentik-bootstrap-token",
                }).catch((error: unknown) => {
                    throw new CLIError("Failed to list tokens in Authentik", error);
                })
                if (bootstrapTokens.results.length === 0) {
                    context.logger.debug("Bootstrap token 'authentik-bootstrap-token' not found in Authentik — skipping deletion");
                } else {
                    await originalAuthentikClient.coreTokensDestroy({
                        identifier: "authentik-bootstrap-token",
                    }).catch((error: unknown) => {
                        throw new CLIError("Failed to delete bootstrap token in Authentik", error);
                    })
                }
                const bootstrapUser = allUsers.results.find(
                    (user) => user.username === "akadmin"
                );
                if (!bootstrapUser) {
                    context.logger.debug("Bootstrap user 'akadmin' not found in Authentik — skipping disable");
                } else {
                    // disable the bootstrap user
                    // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-update
                    await newAuthentikClient.coreUsersUpdate({
                        id: bootstrapUser.pk,
                        userRequest: {
                            username: "akadmin",
                            name: 'Authentik Root User',
                            isActive: false,
                        }
                    }).catch((error: unknown) => {
                        throw new CLIError("Failed to disable bootstrap user in Authentik", error);
                    })
                }

                await upsertPFYAMLFile({
                    context,
                    environment,
                    region,
                    module: MODULES.AUTHENTIK_CORE_RESOURCES,
                    updates: {
                        user_setup_complete: true
                    }
                })

                const webUIURL = `https://${SSO_SUBDOMAIN}.${ctx.ancestorDomain}`
                const globalUserConfigPath = join(context.devshellConfig.environments_dir, GLOBAL_USER_CONFIG)
                context.logger.info([
                    `Authentik setup complete!`,
                    ``,
                    `  Web UI:   ${webUIURL}`,
                    `  Username: ${ctx.authentikAdminEmail}`,
                    `  Password: ${generatedPassword}`,
                    `  API token: Saved to ${globalUserConfigPath}`,
                ].join("\n"))
            }
        }
    ])

    return tasks;
}
