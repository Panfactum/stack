import { join } from "node:path"
import { GetRoleCommand, IAMClient, ListAttachedRolePoliciesCommand, ListAttachedUserPoliciesCommand, NoSuchEntityException } from "@aws-sdk/client-iam";
import { CreateBucketCommand, DeleteBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Listr } from "listr2";
import { stringify, parse } from "yaml";
import { z } from "zod";
import awsAccountHCL from "@/templates/aws_account.hcl" with { type: "file" };
import sopsHCL from "@/templates/sops.hcl" with { type: "file" };
import tfBootstrapResourcesHCL from "@/templates/tf_bootstrap_resources.hcl" with { type: "file" };
import { getAWSProfiles } from "@/util/aws/getAWSProfiles";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import { getIdentity } from "@/util/aws/getIdentity";
import { AWS_ACCOUNT_ALIAS_SCHEMA, AWS_REGIONS } from "@/util/aws/schemas";
import { getConfigValuesFromFile } from "@/util/config/getConfigValuesFromFile";
import { getEnvironments } from "@/util/config/getEnvironments";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLIError } from "@/util/error/error";
import { createDirectory } from "@/util/fs/createDirectory";
import { fileExists } from "@/util/fs/fileExists";
import { removeDirectory } from "@/util/fs/removeDirectory";
import { writeFile } from "@/util/fs/writeFile";
import { GLOBAL_REGION, MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import type { PanfactumContext } from "@/context/context";


export async function bootstrapEnvironment(inputs: {
    context: PanfactumContext,
    environmentName: string;
    environmentProfile?: string
    accountName?: string;
}) {

    const { context, environmentName, environmentProfile, accountName } = inputs

    context.logger.info("Now that account is provisioned, we will configure it for management via infrastructure-as-code.")

    interface TaskCtx {
        version?: string,
        profile?: string,
        primaryRegion?: string,
        secondaryRegion?: string,
        bucketName?: string,
        locktableName?: string,
        accountId?: string
        accountName?: string;
    }

    const tasks = new Listr<TaskCtx>([], {
        ctx: {
            profile: environmentProfile,
            accountName
        },
        rendererOptions: {
            collapseErrors: false
        }
    })

    //////////////////////////////////////////////////////////////
    // Remove the terragrunt directory as it can cause issue if
    // resuming a failed install
    //////////////////////////////////////////////////////////////
    tasks.add({
        title: "Clear cache",
        task: async () => {
            await removeDirectory(join(context.repoVariables.repo_root, ".terragrunt-cache"))
        }
    })

    //////////////////////////////////////////////////////////////
    // Create the environment directory
    //////////////////////////////////////////////////////////////
    const directory = join(context.repoVariables.environments_dir, environmentName)
    tasks.add({
        title: `Create IaC directory for ${environmentName}`,
        task: async () => {
            await createDirectory(directory)
        }
    })

    //////////////////////////////////////////////////////////////
    // Get the stack verson
    //////////////////////////////////////////////////////////////
    tasks.add({
        title: `Getting Panfactum version to deploy`,
        task: async (ctx, task) => {
            const flakeFilePath = join(context.repoVariables.repo_root, "flake.nix")
            if (!await fileExists(flakeFilePath)) {
                throw new CLIError("No flake.nix found at repo root")
            }
            try {
                const flakeContents = await Bun.file(flakeFilePath).text()
                const match = flakeContents.match(/panfactum\/stack\/([-.0-9a-zA-Z]+)/i);
                ctx.version = (match && match[1]) ?? "main";
                task.title = context.logger.applyColors(`Got Panfactum version to deploy ${ctx.version}`, { lowlights: [ctx.version] })
            } catch (e) {
                throw new CLIError("Was not able to get the framework version from the repo's flake.nix file.", e)
            }
        }
    })

    //////////////////////////////////////////////////////////////
    // Get a Valid AWS profile to use for the environment
    //////////////////////////////////////////////////////////////
    tasks.add([
        {
            title: "Select AWS profile for the environment",
            enabled: (ctx) => !ctx.profile,
            rendererOptions: { outputBar: 2 },
            task: async (ctx, task) => {
                const profiles = await getAWSProfiles(context, { throwOnMissingConfig: true })
                ctx.profile = await context.logger.search({
                    task,
                    explainer: `
                    An AWS profile must be selected which will be used to deploy infrastructure to the new '${environmentName}' environment.
                    The profile should have 'AdministratorAccess' permissions as it needs complete access to the AWS account.
                    `,
                    message: "Select AWS profile:",
                    source: (input) => {
                        const filteredProfiles = input ? profiles.filter(profile => profile.includes(input)) : profiles
                        return filteredProfiles
                            .sort((p1, _) => p1.includes("superuser") ? -1 : 1)
                            .map(profile => ({
                                name: profile,
                                value: profile
                            }))
                    },
                    validate: async (profile: string) => {
                        if (profile) {
                            let profileIdentityARN;

                            // Step 1: Verify that the user can use the selected profile.
                            try {
                                const identity = await getIdentity({ context, profile })
                                profileIdentityARN = identity.Arn
                            } catch {
                                return "Was not able to authenticate with the selected profile. Are you sure you have access to the correct credentials?"
                            }

                            // Step 2: Verify that the profile has AdministratorAccess permissions
                            const iamClient = new IAMClient({
                                profile
                            });
                            const isRole = profileIdentityARN?.includes(':role/');
                            const isAssumedRole = profileIdentityARN?.includes(':assumed-role/');
                            if (isRole || isAssumedRole) {
                                const roleName = isAssumedRole ? profileIdentityARN?.split('/')[1] : profileIdentityARN?.split('/').pop() || "";
                                try {
                                    const userPoliciesResponse = await iamClient.send(new ListAttachedRolePoliciesCommand({
                                        RoleName: roleName
                                    }));
                                    const hasAdminAccess = userPoliciesResponse.AttachedPolicies?.some(
                                        (policy: { PolicyName?: string }) => policy.PolicyName === "AdministratorAccess"
                                    );

                                    if (!hasAdminAccess) {
                                        return `Profile '${profile}' is linked to IAM role '${roleName}' which does not have the 'AdministratorAccess' policy assigned.`
                                    }
                                } catch {
                                    return `Profile '${profile}' is linked to IAM role '${roleName}' which does not have the 'AdministratorAccess' policy assigned.`
                                }
                            } else {
                                const userName = profileIdentityARN?.split('/').pop() || "";
                                try {
                                    const userPoliciesResponse = await iamClient.send(new ListAttachedUserPoliciesCommand({
                                        UserName: userName
                                    }));
                                    const hasAdminAccess = userPoliciesResponse.AttachedPolicies?.some(
                                        (policy: { PolicyName?: string }) => policy.PolicyName === "AdministratorAccess"
                                    );
                                    if (!hasAdminAccess) {
                                        return `Profile '${profile}' is linked to IAM user '${userName}' which does not have the 'AdministratorAccess' policy assigned.`
                                    }
                                } catch {
                                    return `Profile '${profile}' is linked to IAM user '${userName}' which does not have the 'AdministratorAccess' policy assigned.`

                                }
                            }
                            return true
                        } else {
                            return true
                        }
                    }
                })
                task.title = context.logger.applyColors(`Selected AWS profile for the environment ${ctx.profile}`, { lowlights: [ctx.profile] })
            }
        },
    ])
    //////////////////////////////////////////////////////////////
    // Get account id
    //////////////////////////////////////////////////////////////
    tasks.add({
        title: "Get AWS account ID",
        task: async (ctx, task) => {
            const { Account: accountId } = await getIdentity({ context, profile: ctx.profile! })
            if (!accountId) {
                throw new CLIError("Failed to get account id from AWS API")
            }
            const environments = await getEnvironments(context)
            for (const environment of environments) {
                const { aws_account_id: otherEnvAccountId } = await getConfigValuesFromFile({
                    filePath: join(environment.path, "environment.yaml"),
                    context
                }) || {}
                if (otherEnvAccountId && otherEnvAccountId === accountId) {
                    throw new CLIError(
                        `Chosen profile '${ctx.profile!}' is for AWS account ${accountId} which is already in use for the '${environment.name}' environment. ` +
                        `Each AWS account should only be used for a single environment.`
                    )
                }
            }
            ctx.accountId = accountId
            task.title = context.logger.applyColors(`Got AWS account ID ${accountId}`, { lowlights: [accountId] })
        }
    })

    //////////////////////////////////////////////////////////////
    // Select regions
    //////////////////////////////////////////////////////////////
    tasks.add({
        title: "Select regions",
        task: async (ctx, task) => {

            ctx.primaryRegion = await context.logger.search({
                explainer: `Every environment must have a primary AWS region where resources like the infrastructure state bucket will live.`,
                message: "Select primary AWS region:",
                task,
                source: async (input) => {
                    const filertedRegions = input ? AWS_REGIONS.filter(region => region.includes(input)) : AWS_REGIONS
                    return filertedRegions.map(region => ({
                        name: region,
                        value: region
                    }))
                }
            })

            task.title = context.logger.applyColors(`Select regions ${ctx.primaryRegion}`, { lowlights: [ctx.primaryRegion] })

            ctx.secondaryRegion = await context.logger.search({
                explainer: `Every environment must have a secondary AWS region where resources like the infrastructure state bucket will live.`,
                message: "Select secondary AWS region:",
                task,
                source: async (input) => {
                    const filertedRegions = input ? AWS_REGIONS.filter(region => region.includes(input)) : AWS_REGIONS
                    return filertedRegions
                        .filter(region => region !== ctx.primaryRegion)
                        .map(region => ({
                            name: region,
                            value: region
                        }))
                }
            })
            task.title = context.logger.applyColors(`Selected regions ${ctx.primaryRegion} | ${ctx.secondaryRegion}`, {
                lowlights: [`${ctx.primaryRegion} | ${ctx.secondaryRegion}`]
            })
        }
    })


    //////////////////////////////////////////////////////////////
    // Generate the bucket and lock table names
    //////////////////////////////////////////////////////////////
    tasks.add({
        title: "Generate unique state bucket name",
        task: async (ctx, task) => {
            while (!ctx.bucketName || !ctx.locktableName) {
                const randomString = [...new Array(8)]
                    .map(() => Math.floor(Math.random() * 36).toString(36))
                    .join('')
                    .toLowerCase();

                // Truncate environment name to ensure total bucket name is under 63 chars
                // Format: tf-{envName}-{8chars} = 3 + 1 + envName + 1 + 8 chars
                const maxEnvLength = 50; // 63 - 3 - 1 - 1 - 8 = 50
                const truncatedEnvName = environmentName.slice(0, maxEnvLength);
                const proposedBucketName = `tf-${truncatedEnvName}-${randomString}`;

                // Check if bucket already exists
                try {

                    // Required due to https://github.com/aws/aws-sdk-js-v3/issues/6872
                    const credentials = await getCredsFromFile({ context, profile: ctx.profile! })

                    const s3Client = new S3Client({
                        region: ctx.primaryRegion!,
                        profile: ctx.profile!,
                        credentials
                    });
                    await s3Client.send(new HeadBucketCommand({
                        Bucket: proposedBucketName
                    }));
                    continue;
                } catch (error) {
                    if (error instanceof Error && error.name === 'NotFound') {
                        ctx.bucketName = proposedBucketName;
                        ctx.locktableName = proposedBucketName;

                        // TODO @jack - retry loop - fails in af-south-1 for some reason? 
                    } else {
                        throw new CLIError(`Failed to check if S3 bucket '${proposedBucketName}' exists`, error);
                    }
                }
            }
            task.title = context.logger.applyColors(`Generated unique state bucket name ${ctx.bucketName}`, { lowlights: [ctx.bucketName] })
        }
    })

    //////////////////////////////////////////////////////////////
    // Verify that S3 service is active
    //////////////////////////////////////////////////////////////
    tasks.add({
        title: "Activate S3 service",
        task: async (ctx, task) => {
            // Try to create and delete a dummy S3 bucket to ensure S3 service is active
            // This helps avoid the "Your account is not signed up for the S3 service" error
            // which can occur when an AWS account is newly created

            const dummyBucketName = `s3-activation-test-${Date.now()}`;
            let bucketCreated = false;
            let retryCount = 0;
            const maxRetries = 30;
            const credentials = await getCredsFromFile({ context, profile: ctx.profile! });

            const s3Client = new S3Client({
                region: ctx.primaryRegion!,
                profile: ctx.profile!,
                credentials
            });

            while (retryCount < maxRetries) {
                const attemptPhrase = `attempt ${retryCount + 1}/${maxRetries}`
                task.title = context.logger.applyColors(`Activating S3 service ${attemptPhrase}`, { lowlights: [attemptPhrase] });
                try {
                    await s3Client.send(new CreateBucketCommand({
                        Bucket: dummyBucketName
                    }));
                    bucketCreated = true;
                    break;
                } catch (error) {
                    if (error instanceof Error &&
                        error.message.includes("not signed up")) {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            const delay = Math.min(15000, 1000 * Math.pow(2, retryCount)) + Math.random() * 1000;
                            await new Promise((resolve) => {
                                globalThis.setTimeout(resolve, delay);
                            });
                        } else {
                            throw new CLIError("S3 service did not activate after multiple attempts. The AWS account may still be provisioning S3 access.", error);
                        }
                    } else {
                        // If it's some other error, S3 service is likely active but there's another issue
                        // so we can continue safely
                        break;
                    }
                }
            }

            if (bucketCreated) {
                task.title = context.logger.applyColors(`S3 service is active Cleaning up test bucket`, { lowlights: ["Cleaning up test bucket"] })
                let deleteRetries = 0;
                const maxDeleteRetries = 10;
                while (deleteRetries < maxDeleteRetries) {
                    try {
                        await s3Client.send(new DeleteBucketCommand({
                            Bucket: dummyBucketName
                        }));
                        break;
                    } catch (e) {
                        deleteRetries++;
                        if (deleteRetries >= maxDeleteRetries) {
                            context.logger.error(`Failed to delete dummy bucket ${dummyBucketName} after ${maxDeleteRetries} attempts: ${JSON.stringify(e)}`);
                        } else {
                            context.logger.error(`Retry ${deleteRetries}/${maxDeleteRetries} deleting dummy bucket ${dummyBucketName}`);
                            const delay = Math.min(15000, 1000 * Math.pow(2, deleteRetries)) +
                                (Math.random() * 1000);
                            await new Promise((resolve) => {
                                globalThis.setTimeout(resolve, delay);
                            });
                        }
                    }
                }
            }
            task.title = "S3 service is active"
        }
    })

    //////////////////////////////////////////////////////////////
    // Generate the relevant config files
    //////////////////////////////////////////////////////////////
    const globalRegionDir = join(directory, GLOBAL_REGION)

    tasks.add({
        title: "Generate IaC config files",
        task: async (ctx) => {
            await Promise.all([
                upsertConfigValues({
                    context,
                    filePath: join(directory, "environment.yaml"),
                    values: {
                        environment: environmentName,
                        aws_account_id: ctx.accountId,
                        aws_profile: ctx.profile!,
                        pf_stack_version: ctx.version!,
                        tf_state_bucket: ctx.bucketName!,
                        tf_state_lock_table: ctx.locktableName!,
                        tf_state_region: ctx.primaryRegion!
                    }
                }),
                upsertConfigValues({
                    context,
                    filePath: join(directory, ctx.primaryRegion!, "region.yaml"),
                    values: {
                        aws_region: ctx.primaryRegion!,
                        aws_secondary_region: ctx.secondaryRegion!
                    }
                }),
                upsertConfigValues({
                    context,
                    filePath: join(directory, ctx.secondaryRegion!, "region.yaml"),
                    values: {
                        aws_region: ctx.secondaryRegion!,
                        aws_secondary_region: ctx.primaryRegion!
                    }
                }),
                upsertConfigValues({
                    context,
                    filePath: join(globalRegionDir, "region.yaml"),
                    values: {
                        aws_region: ctx.primaryRegion!,
                        aws_secondary_region: ctx.secondaryRegion!
                    }
                })
            ])
        }
    })



    //////////////////////////////////////////////////////////////
    // Generate the bootstrap resources
    //////////////////////////////////////////////////////////////
    tasks.add(
        await buildDeployModuleTask<TaskCtx>({
            context,
            environment: environmentName,
            region: GLOBAL_REGION,
            module: MODULES.TF_BOOTSTRAP_RESOURCES,
            hclIfMissing: await Bun.file(tfBootstrapResourcesHCL).text(),
            taskTitle: "Deploy IaC state bucket",
            imports: {
                "aws_s3_bucket.state": {
                    resourceId: (ctx) => ctx.bucketName!
                },
                "aws_dynamodb_table.lock": {
                    resourceId: (ctx) => ctx.locktableName!
                }
            }
        })
    )

    //////////////////////////////////////////////////////////////
    // Deploy the encryption keys
    //////////////////////////////////////////////////////////////

    tasks.add(
        await buildDeployModuleTask<TaskCtx>({
            context,
            environment: environmentName,
            region: GLOBAL_REGION,
            module: "sops",
            hclIfMissing: await Bun.file(sopsHCL).text(),
            realModuleName: MODULES.AWS_KMS_ENCRYPT_KEY,
            taskTitle: "Deploy encryptions keys",
            inputUpdates: {
                name: defineInputUpdate({
                    schema: z.string(),
                    update: () => `sops-${environmentName}`
                })
            }
        })
    )

    //////////////////////////////////////////////////////////////
    // Update the repository's sops configuration
    //////////////////////////////////////////////////////////////
    tasks.add({
        title: "Add encryption keys to DevShell",
        task: async (ctx) => {
            const { arn, arn2 } = await terragruntOutput({
                context,
                environment: environmentName,
                region: GLOBAL_REGION,
                module: "sops",
                validationSchema: z.object({
                    arn: z.object({
                        value: z.string()
                    }),
                    arn2: z.object({
                        value: z.string()
                    }),
                })
            });

            const sopsFilePath = join(context.repoVariables.repo_root, ".sops.yaml")
            const newCreationRule = {
                path_regex: `.*/${environmentName}/.*`,
                aws_profile: ctx.profile!,
                kms: `${arn.value},${arn2.value}`
            }
            context.logger.debug("New encrpytion config: " + JSON.stringify(newCreationRule))

            if (await fileExists(sopsFilePath)) {
                const fileContent = await Bun.file(sopsFilePath).text();
                const existingConfig = parse(fileContent) as { creation_rules?: [] }
                await writeFile({
                    context,
                    path: sopsFilePath,
                    contents: stringify({
                        ...existingConfig,
                        creation_rules: [
                            ...(existingConfig.creation_rules ?? []),
                            newCreationRule
                        ]
                    }),
                    overwrite: true
                })
            } else {
                await writeFile({
                    context,
                    path: sopsFilePath,
                    contents: stringify({
                        creation_rules: [newCreationRule]
                    }),
                    overwrite: true
                })
            }
        }
    })

    //////////////////////////////////////////////////////////////
    // Set the account name
    //////////////////////////////////////////////////////////////
    tasks.add(
        {
            title: "Set AWS account alias",
            enabled: (ctx) => ctx.accountName === undefined,
            task: async (ctx, task) => {
                ctx.accountName = await context.logger.input({
                    message: 'Unique Account Alias:',
                    validate: async (value) => {
                        const { error } = AWS_ACCOUNT_ALIAS_SCHEMA.safeParse(value)
                        if (error) {
                            return error.issues[0]?.message ?? "Invalid account name"
                        }

                        const response = await globalThis.fetch(`https://${value}.signin.aws.amazon.com`)
                        if (response.status !== 404) {
                            return `Every account must have a globally unique name. Name is already taken.`
                        }
                        return true
                    },
                    task
                })
            }
        }
    )

    //////////////////////////////////////////////////////////////
    // Deploy the AWS Account module
    //////////////////////////////////////////////////////////////
    tasks.add(
        await buildDeployModuleTask<TaskCtx>({
            context,
            environment: environmentName,
            region: GLOBAL_REGION,
            module: MODULES.AWS_ACCOUNT,
            hclIfMissing: await Bun.file(awsAccountHCL).text(),
            taskTitle: "Setup AWS Account",
            inputUpdates: {
                alias: defineInputUpdate({
                    schema: z.string(),
                    update: (_, { accountName }) => {
                        if (accountName === undefined) {
                            throw new CLIError("accountName is undefined")
                        }
                        return accountName
                    }
                })
            },
            imports: {
                "aws_iam_service_linked_role.spot": {
                    shouldImport: async (ctx) => {
                        const credentials = await getCredsFromFile({ context, profile: ctx.profile! });
                        try {
                            const iamClient = new IAMClient({
                                region: GLOBAL_REGION,
                                credentials
                            });

                            const getRoleCommand = new GetRoleCommand({
                                RoleName: 'AWSServiceRoleForEC2Spot'
                            });

                            await iamClient.send(getRoleCommand);
                            return true;
                        } catch (error) {
                            if (error instanceof NoSuchEntityException) {
                                return false;
                            } else {
                                // For any other error, swallow it, just in case we can recover
                                context.logger.debug(`Failed to query for service-linked role 'AWSServiceRoleForEC2Spot': ${JSON.stringify(error)}`)
                                return false;
                            }
                        }
                    },
                    resourceId: (ctx) => `arn:aws:iam::${ctx.accountId!}:role/aws-service-role/spot.amazonaws.com/AWSServiceRoleForEC2Spot`
                }
            }
        })
    )


    try {
        await tasks.run()
    } catch (e) {
        throw new CLIError(`Failed to perform initial setup for environment ${environmentName}`, e)
    }

}