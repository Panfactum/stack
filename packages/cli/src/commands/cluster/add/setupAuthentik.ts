import { join } from "node:path";
import { z } from "zod";
import kubeSESDomainHcl from "@/templates/aws_ses_domain.hcl" with { type: "file" };
import kubeAuthentikHcl from "@/templates/kube_authentik.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { findFolder } from "@/util/fs/findFolder";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

// const AUTHENTIK_PAGINATION_SCHEMA = z.object({
//     next: z.number(),
//     previous: z.number(),
//     count: z.number(),
//     current: z.number(),
//     total_pages: z.number(),
//     start_index: z.number(),
//     end_index: z.number(),
// });

export async function setupClusterExtensions(
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
        ancestorDomain?: string;
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
            task: async (ctx) => {
                // See if kube_authentik/terragrunt.hcl exist somewhere
                const repoRoot = context.repoVariables.repo_root
                let kubeAuthentikPath = null;
                try {
                    kubeAuthentikPath = await findFolder(repoRoot, "kube_authentik");
                } catch {
                    throw new CLIError("Errored while trying to find kube_authentik folder");
                }

                if (!kubeAuthentikPath) {
                    const notProd = !environment.includes("prod")
                    const confirmInstall = await context.logger.confirm({
                        message: "Do you want to install Authentik?",
                        default: true,
                        explainer: notProd ? "We recommend installing Authentik in the production environment." : undefined
                    });

                    // If they say no, rebuke and confirm
                    if (!confirmInstall) {
                        const confirmExit = await context.logger.confirm({
                            message: "Are you sure you want to exit?",
                            explainer: { message: "We STRONGLY recommend completing this step if possible.", highlights: ["STRONGLY"] },
                            default: false,
                        });

                        // If they still say no, exit
                        if (confirmExit) {
                            throw new CLIError("Exiting...");
                        }
                    }

                    ctx.ancestorDomain = await context.logger.select({
                        explainer: {
                            message: `Which domain do you want to use for e-mails from Authentik?`,
                        },
                        message: "Environment domain:",
                        choices: Object.keys(domains).map(domain => ({ value: domain, name: domain })),
                    });

                    ctx.authentikAdminEmail = await context.logger.input({
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

                    ctx.orgName = await context.logger.input({
                        explainer: "This will be how your organization is referenced on the Authentik web UI.",
                        message: "Organization name:",
                    })

                    ctx.authentikAdminEmail = await context.logger.input({
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

                    ctx.authentikAdminName = await context.logger.input({
                        explainer: "This will be your name in Authentik.",
                        message: "Name:",
                        required: true,
                    })
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
            }
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
            }
        }),
        {
            title: "Setup your Authentik user", task: async () => {
                // TODO: Validation schema confirmation
                const outputs = await terragruntOutput({
                    context,
                    environment,
                    region,
                    module: MODULES.KUBE_AUTHENTIK,
                    validationSchema: z.record(
                        z.string(),
                        z.object({
                            sensitive: z.boolean(),
                        })
                    )
                })

                if (!outputs["akadmin_bootstrap_token"]) {
                    throw new CLIError("akadmin_bootstrap_token not found in Authentik module outputs")
                }
            }
        }
    ])

    return tasks;
}





// const outputs = getModuleOutputs({
//     context,
//     modulePath: path.join(authentikClusterPath, "./kube_authentik"),
//     verbose,
//     validationSchema: z.record(
//         z.string(),
//         z.object({
//             sensitive: z.boolean(),
//             type: z.any(),
//             value: z.string(),
//         })
//     ),
// });

// if (!outputs["akadmin_bootstrap_token"]) {
//     throw new Error(
//         "akadmin_bootstrap_token not found in Authentik module outputs"
//     );
// }

// const authentikBrandsResponse = await Bun.fetch(
//     `https://${domain}/api/v3/core/brands/`,
//     {
//         headers: {
//             Authorization: `Bearer ${outputs["akadmin_bootstrap_token"].value}`,
//             Accept: "application/json",
//         },
//     }
// );
// const authentikBrands = await authentikBrandsResponse.json();
// const brandsSchema = z.object({
//     pagination: paginationSchema,
//     results: z.array(
//         z.object({
//             brand_uuid: z.string(),
//             domain: z.string(),
//             default: z.boolean(),
//             branding_title: z.string().optional(),
//             branding_logo: z.string().optional(),
//             branding_favicon: z.string().optional(),
//             flow_authentication: z.string().nullable(),
//             flow_invalidation: z.string().nullable(),
//             flow_recovery: z.string().nullable(),
//             flow_unenrollment: z.string().nullable(),
//             flow_user_settings: z.string().nullable(),
//             flow_device_code: z.string().nullable(),
//             default_application: z.string().nullable(),
//             web_certificate: z.string().nullable(),
//             attributes: z.any(),
//         })
//     ),
// });
// const authentikBrandsValidated = brandsSchema.parse(authentikBrands);
// const authentikDefaultBrand = authentikBrandsValidated.results.find(
//     (brand) => brand.domain === "authentik-default"
// );
// if (authentikDefaultBrand) {
//     await Bun.fetch(
//         `https://${domain}/api/v3/core/brands/${authentikDefaultBrand.brand_uuid}/`,
//         {
//             method: "PUT",
//             headers: {
//                 Authorization: `Bearer ${outputs["akadmin_bootstrap_token"].value}`,
//             },
//             body: JSON.stringify({
//                 ...authentikBrandsValidated,
//                 default: false,
//             }),
//         }
//     );
// }

// await ensureFileExists({
//     context,
//     destinationFile: path.join(
//         repoVariables.environments_dir,
//         "global.yaml"
//     ),
//     sourceFile: await Bun.file("").text(),
// });

// await replaceYamlValue(
//     path.join(repoVariables.environments_dir, "global.yaml"),
//     "authentik_url",
//     `https://${domain}`
// );

// await updateConfigFile({
//     updates: {
//         authentikSetup: true,
//         akadminBootstrapToken: outputs["akadmin_bootstrap_token"].value,
//         authentikDomain: domain,
//         authentikEmail: email,
//     },
//     configPath,
//     context,
// });
// }

// // https://panfactum.com/docs/edge/guides/bootstrapping/identity-provider#configure-authentik---automated-set-up
// let configureAuthentikComplete = false;
// try {
//     configureAuthentikComplete = await checkStepCompletion({
//         configFilePath: configPath,
//         context,
//         step: "configureAuthentik",
//         stepCompleteMessage:
//             "14.c. Skipping Authentik configuration as it's already complete.\n",
//         stepNotCompleteMessage: "14.c. Configuring Authentik\n",
//     });
// } catch {
//     throw new Error("Failed to check if Authentik setup is complete");
// }
// if (!configureAuthentikComplete) {

//     const domainParts = authentikDomain.split(".");
//     const baseDomain =
//         domainParts.length >= 2
//             ? domainParts.slice(-2).join(".")
//             : authentikDomain;

//     await ensureFileExists({
//         context,
//         destinationFile: path.join(
//             authentikClusterPath,
//             "authentik_core_resources/terragrunt.hcl"
//         ),
//         sourceFile: await Bun.file(authentikCoreResourcesTerragruntHcl).text(),
//     });

//     await replaceHclValue(
//         path.join(
//             authentikClusterPath,
//             "authentik_core_resources/terragrunt.hcl"
//         ),
//         "inputs.organization_name",
//         orgName
//     );

//     await replaceHclValue(
//         path.join(
//             authentikClusterPath,
//             "authentik_core_resources/terragrunt.hcl"
//         ),
//         "inputs.organization_domain",
//         baseDomain
//     );

//     await initAndApplyModule({
//         context,
//         moduleName: "Authentik Core Resources",
//         modulePath: path.join(authentikClusterPath, "authentik_core_resources"),
//         verbose,
//     });

//     await updateConfigFile({
//         updates: {
//             configureAuthentik: true,
//         },
//         configPath,
//         context,
//     });
// }

// // https://panfactum.com/docs/edge/guides/bootstrapping/identity-provider#provision-your-user
// let provisionUserComplete = false;
// try {
//     provisionUserComplete = await checkStepCompletion({
//         configFilePath: configPath,
//         context,
//         step: "provisionUser",
//         stepCompleteMessage:
//             "14.d. Skipping Authentik user provisioning as it's already complete.\n",
//         stepNotCompleteMessage: "14.d. Provisioning Authentik user\n",
//     });
// } catch {
//     throw new Error(
//         "Failed to check if Authentik user provisioning is complete"
//     );
// }
// if (!provisionUserComplete) {
//     context.stdout.write(
//         pc.blue("We will now setup your user in Authentik\n")
//     );
//     const authentikDomain = await getConfigFileKey({
//         configPath,
//         context,
//         key: "authentikDomain",
//     });
//     const akadminBootstrapToken = await getConfigFileKey({
//         configPath,
//         context,
//         key: "akadminBootstrapToken",
//     });
//     const authentikEmail = await getConfigFileKey({
//         configPath,
//         context,
//         key: "authentikEmail",
//     });

//     if (!authentikEmail || typeof authentikEmail !== "string") {
//         throw new Error("Authentik email not found in setup file.");
//     }
//     if (!authentikDomain || typeof authentikDomain !== "string") {
//         throw new Error("Authentik domain not found in setup file.");
//     }
//     if (!akadminBootstrapToken || typeof akadminBootstrapToken !== "string") {
//         throw new Error("Bootstrap token not found in setup file.");
//     }
//     const authentikUrl = `https://${authentikDomain}`;

//     // get superusers group uuid
//     // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-groups-list
//     const groupsResponse = await Bun.fetch(
//         `${authentikUrl}/api/v3/core/groups/`,
//         {
//             headers: {
//                 Accept: "application/json",
//                 Authorization: `Bearer ${akadminBootstrapToken}`,
//             },
//         }
//     );
//     if (groupsResponse.status !== 200) {
//         throw new Error("Failed to get groups in Authentik");
//     }
//     const groups = await groupsResponse.json();
//     const groupsSchema = z.object({
//         pagination: paginationSchema,
//         results: z.array(
//             z.object({
//                 pk: z.string(),
//                 num_pk: z.number(),
//                 name: z.string(),
//                 is_superuser: z.boolean(),
//                 parent: z.string().nullable(),
//                 parent_name: z.string().nullable(),
//                 users: z.array(z.number()),
//                 users_obj: z.array(
//                     z.object({
//                         pk: z.number(),
//                         username: z.string(),
//                         name: z.string(),
//                         is_active: z.boolean(),
//                         last_login: z.string().nullable(),
//                         email: z.string(),
//                         attributes: z.any(),
//                         uid: z.string(),
//                     })
//                 ),
//                 attributes: z.any(),
//                 roles: z.array(z.string()),
//                 roles_obj: z.array(z.object({ pk: z.string(), name: z.string() })),
//             })
//         ),
//     });
//     const groupsValidated = groupsSchema.parse(groups);
//     const superusersGroup = groupsValidated.results.find(
//         (group) => group.name === "superusers"
//     );
//     if (!superusersGroup) {
//         throw new Error("Superusers group not found in Authentik");
//     }
//     const superusersGroupUuid = superusersGroup.pk;

//     // create the user via API
//     // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-create
//     const createUserResponse = await Bun.fetch(
//         `${authentikUrl}/api/v3/core/users/`,
//         {
//             method: "POST",
//             headers: {
//                 Accept: "application/json",
//                 Authorization: `Bearer ${akadminBootstrapToken}`,
//             },
//             body: JSON.stringify({
//                 username: username,
//                 name: name,
//                 email: username,
//                 is_active: true,
//                 groups: [superusersGroupUuid],
//                 path: "users",
//                 type: "internal",
//                 attributes: {},
//             }),
//         }
//     );

//     if (createUserResponse.status !== 201) {
//         throw new Error("Failed to create user in Authentik");
//     }
//     const user = (await createUserResponse.json()) as { pk: number };
//     const userId = user.pk;

//     // get the password reset link and provide it to the user
//     const passwordResetResponse = await Bun.fetch(
//         `${authentikUrl}/api/v3/core/users/${userId}/recovery/`,
//         {
//             method: "POST",
//             headers: {
//                 Accept: "application/json",
//                 Authorization: `Bearer ${akadminBootstrapToken}`,
//             },
//         }
//     );
//     if (passwordResetResponse.status !== 200) {
//         throw new Error("Failed to get password reset link in Authentik");
//     }
//     const passwordReset = (await passwordResetResponse.json()) as {
//         link: string;
//     };
//     const passwordResetLink = passwordReset.link;

//     // create the API token
//     const createTokenResponse = await Bun.fetch(
//         `${authentikUrl}/api/v3/core/tokens/`,
//         {
//             method: "POST",
//             headers: {
//                 Accept: "application/json",
//                 Authorization: `Bearer ${akadminBootstrapToken}`,
//             },
//             body: JSON.stringify({
//                 managed: null,
//                 identifier: "local-framework-token",
//                 intent: "api",
//                 user: userId,
//                 expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
//                 expiring: true,
//                 description:
//                     "Created while running the Panfactum CLI and used to interact with Authentik from the local machine.",
//             }),
//         }
//     );

//     if (createTokenResponse.status !== 201) {
//         throw new Error("Failed to create API token in Authentik");
//     }
//     const token = (await createTokenResponse.json()) as { pk: string };
//     const userTokenPk = token.pk;

//     context.stdout.write(
//         pc.blue(
//             `Go ahead and setup your account\nWhen you're done don't exit the web browser\nWe will need some info to continue\nUse this link to setup your account:\n${passwordResetLink}\n`
//         )
//     );

//     const accountSetupComplete = await confirm({
//         message: pc.magenta(
//             "Have you setup your Authentik account?\nYou must complete that before continuing."
//         ),
//         default: true,
//     });

//     if (!accountSetupComplete) {
//         const accountSetupCompleteAgain = await confirm({
//             message: pc.magenta(
//                 "Have you setup your Authentik account?\nYou must complete that before continuing."
//             ),
//             default: true,
//         });
//         if (!accountSetupCompleteAgain) {
//             context.stdout.write(
//                 pc.red(
//                     "You must complete the account setup before continuing.\nExiting...\n"
//                 )
//             );
//             return 0;
//         }
//     }

//     // replace bootstrap token with API token
//     const newToken = await password({
//         message: pc.magenta(
//             "We have created a new temporary API token to use\n" +
//             `Go to https://${authentikDomain}/if/user/#/settings;%7B%22page%22%3A%22page-tokens%22%7D\n` +
//             "Look for the token with the identifier 'local-framework-token'\n" +
//             "Copy the token and paste it here:"
//         ),
//         validate: async (value) => {
//             try {
//                 const proc = Bun.spawnSync([
//                     "curl",
//                     "-s",
//                     "-H",
//                     `Authorization: Bearer ${value}`,
//                     `${authentikUrl}/api/v3/core/groups/`,
//                     "-w",
//                     "'%{http_code}'",
//                     "-o",
//                     "/dev/null",
//                 ]);
//                 const result = proc.stdout.toString().trim().replace("%", "");
//                 if (result !== "200") {
//                     return "This does not appear to be a valid Authentik Access Token. Please try again.";
//                 }
//                 return true;
//             } catch {
//                 return "Error validating Authentik Access Token, please try again.";
//             }
//         },
//     });

//     // Add AUTHENTIK_TOKEN to .env file
//     const envFilePath = `${repoRoot}/.env`;
//     await ensureFileExists({
//         context,
//         destinationFile: envFilePath,
//         sourceFile: "",
//     });
//     await appendFile(envFilePath, `AUTHENTIK_TOKEN=${newToken}\n`);

//     // get all the tokens
//     // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-list
//     const tokensResponse = await Bun.fetch(
//         `${authentikUrl}/api/v3/core/tokens/`,
//         {
//             headers: {
//                 Accept: "application/json",
//                 Authorization: `Bearer ${newToken}`,
//             },
//         }
//     );
//     if (tokensResponse.status !== 200) {
//         throw new Error("Failed to get tokens from Authentik");
//     }
//     const tokens = await tokensResponse.json();
//     const tokensSchema = z.object({
//         pagination: paginationSchema,
//         results: z.array(z.object({ pk: z.string(), identifier: z.string() })),
//     });
//     const tokensValidated = tokensSchema.parse(tokens);
//     const bootstrapToken = tokensValidated.results.filter(
//         (token) => token.pk !== userTokenPk
//     );
//     if (bootstrapToken.length !== 1) {
//         throw new Error("Bootstrap token not found in Authentik");
//     }
//     const bootstrapTokenUuid = bootstrapToken[0]!.pk;

//     // delete the bootstrap token
//     // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-tokens-destroy
//     const deleteTokenResponse = await Bun.fetch(
//         `${authentikUrl}/api/v3/core/tokens/${bootstrapTokenUuid}/`,
//         {
//             method: "DELETE",
//             headers: {
//                 Accept: "application/json",
//                 Authorization: `Bearer ${newToken}`,
//             },
//         }
//     );
//     if (deleteTokenResponse.status !== 204) {
//         throw new Error("Failed to delete bootstrap token in Authentik");
//     }

//     // get all the users
//     // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-list
//     const usersResponse = await Bun.fetch(
//         `${authentikUrl}/api/v3/core/users/`,
//         {
//             headers: {
//                 Accept: "application/json",
//                 Authorization: `Bearer ${newToken}`,
//             },
//         }
//     );
//     if (usersResponse.status !== 200) {
//         throw new Error("Failed to get users from Authentik");
//     }
//     const users = await usersResponse.json();
//     const usersSchema = z.object({
//         pagination: paginationSchema,
//         results: z.array(z.object({ pk: z.number(), username: z.string() })),
//     });
//     const usersValidated = usersSchema.parse(users);
//     const bootstrapUser = usersValidated.results.find(
//         (user) => user.username === authentikEmail
//     );
//     if (!bootstrapUser) {
//         throw new Error("Bootstrap user not found in Authentik");
//     }
//     const bootstrapUserUuid = bootstrapUser.pk;

//     // disable the bootstrap user
//     // https://docs.goauthentik.io/docs/developer-docs/api/reference/core-users-update
//     const disableUserResponse = await Bun.fetch(
//         `${authentikUrl}/api/v3/core/users/${bootstrapUserUuid}/`,
//         {
//             method: "PUT",
//             headers: {
//                 Accept: "application/json",
//                 Authorization: `Bearer ${newToken}`,
//             },
//             body: JSON.stringify({ ...bootstrapUser, is_active: false }),
//         }
//     );
//     if (disableUserResponse.status !== 200) {
//         throw new Error("Failed to disable bootstrap user in Authentik");
//     }
// }

// await updateConfigFile({
//     configPath,
//     context,
//     updates: {
//         provisionUser: true,
//     },
// });