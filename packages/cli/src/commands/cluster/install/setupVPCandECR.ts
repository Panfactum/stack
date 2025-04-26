import path from "node:path";
import { input, password } from "@inquirer/prompts";
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { Listr } from "listr2";
import { z } from "zod";
import { vpcNetworkTest } from "@/commands/aws/vpc-network-test/vpcNetworkTest";
import awsEcrPullThroughCacheTerragruntHcl from "@/templates/aws_ecr_pull_through_cache_terragrunt.hcl" with { type: "file" };
import awsVpcTerragruntHcl from "@/templates/aws_vpc_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { applyColors } from "@/util/colors/applyColors";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLIError } from "@/util/error/error";
import { parseErrorHandler } from "@/util/error/parseErrorHandler";
import { fileExists } from "@/util/fs/fileExists";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { execute } from "@/util/subprocess/execute";
import { MODULES } from "@/util/terragrunt/constants";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import type { InstallClusterStepOptions } from "./common";

const DESCRIBE_VPCS_SCHEMA = z.object({
  Vpcs: z.array(z.object({})),
});

const DOCKERHUB_USERNAME = z
  .string()
  .min(3, "DockerHub username must be at least 3 characters long")
  .max(63, "DockerHub username must be less than 63 characters long")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must only contain the letters a-z (case-insensitive), numbers 0-9, hyphens (-), and underscores (_)"
  )
  .regex(/^(?!aws:).*$/i, "Cannot start with 'AWS:' (case insensitive)");

const GITHUB_USERNAME = z
  .string()
  .min(3, "GitHub username must be at least 3 characters long")
  .max(63, "GitHub username must be less than 63 characters long")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must only contain the letters a-z (case-insensitive), numbers 0-9, hyphens (-), and underscores (_)"
  );

const VPC_DESCRIPTION = z
  .string()
  .min(3, "VPC description must be at least 3 characters long")
  .max(255, "VPC description must be less than 255 characters long")
  .regex(
    /^[a-zA-Z0-9_\- .:/=+@]+$/,
    "Must only contain spaces, the letters a-z (case-insensitive), numbers 0-9, and the following characters: _.:/=+-@"
  );

const VPC_NAME = z
  .string()
  .min(3, "VPC name must be at least 3 characters long")
  .max(100, "VPC name must be less than 100 characters long")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must only contain the letters a-z (case-insensitive), numbers 0-9, hyphens (-), and underscores (_)"
  );

export async function setupVPCandECR(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const { awsProfile, context, environment, clusterPath, region } = options;

  const tasks = new Listr([]);

  tasks.add({
    skip: () => completed,
    title: "Foundational AWS Setup",
    task: async (_, parentTask) => {
      interface Context {
        vpcName?: string;
        vpcDescription?: string;
        dockerHubUsername?: string;
        githubUsername?: string;
      }

      return parentTask.newListr<Context>([
        {
          title: "Verify access",
          task: async () => {
            await getIdentity({ context, profile: awsProfile });
          },
        },
        {
          title: "Get VPC configuration",
          task: async (ctx, task) => {
            const originalInputs = await readYAMLFile({
              filePath: path.join(clusterPath, MODULES.AWS_VPC, "module.yaml"),
              context,
              validationSchema: z
                .object({
                  extra_inputs: z
                    .object({
                      vpc_name: z.string().optional(),
                      vpc_description: z.string().optional(),
                    })
                    .passthrough()
                    .optional()
                    .default({}),
                })
                .passthrough(),
            });

            ctx.vpcName = originalInputs?.extra_inputs.vpc_name;
            ctx.vpcDescription = originalInputs?.extra_inputs.vpc_description;

            if (
              ctx.vpcName &&
              ctx.vpcDescription
            ) {
              task.skip("Already have VPC configuration, skipping...");
              return;
            }

            if (!ctx.vpcName) {
              ctx.vpcName = await task
                .prompt(ListrInquirerPromptAdapter)
                .run(input, {
                  message: applyColors("Enter a name for your VPC:", { style: "question" }),
                  default: `panfactum-${environment}-${region}`,
                  required: true,
                  validate: async (value) => {
                    const { error } = VPC_NAME.safeParse(value);
                    if (error) {
                      return error?.issues[0]?.message ?? "Invalid name";
                    } else {
                      // FIX: @seth - Use AWS SDK
                      const vpcListCommand = [
                        "aws",
                        "ec2",
                        "describe-vpcs",
                        `--region=${region}`,
                        `--filters=Name=tag:Name,Values=${value}`,
                        "--output=json",
                        `--profile=${awsProfile}`,
                        "--no-cli-pager",
                      ];

                      context.logger.log(
                        "vpc list command: " + vpcListCommand.join(" "),
                        {
                          level: "debug",
                        }
                      );

                      const { stdout, stderr } = await execute({
                        command: vpcListCommand,
                        context: context,
                        workingDirectory: clusterPath,
                      });

                      context.logger.log(
                        "aws ec2 describe-vps stdout: " + stdout,
                        {
                          level: "debug",
                        }
                      );
                      context.logger.log(
                        "aws ec2 describe-vps stderr: " + stderr,
                        {
                          level: "debug",
                        }
                      );

                      let vpcList;
                      try {
                        const vpc = JSON.parse(stdout);
                        vpcList = DESCRIBE_VPCS_SCHEMA.parse(vpc);
                      } catch (e) {
                        parseErrorHandler({
                          error: e,
                          genericErrorMessage:
                            "Failed checking if VPC name is already in use.",
                          zodErrorMessage:
                            "Failed checking if VPC name is already in use.",
                          command: vpcListCommand.join(" "),
                        });
                      }

                      if (vpcList?.Vpcs.length && vpcList.Vpcs.length > 0) {
                        return `A VPC already exists in AWS with the name ${value}. Please choose a different name.`;
                      } else {
                        return true;
                      }
                    }
                  },
                });
            }

            if (!ctx.vpcDescription) {
              ctx.vpcDescription = await task
                .prompt(ListrInquirerPromptAdapter)
                .run(input, {
                  message: applyColors("Enter a description for your VPC:", { style: "question" }),
                  default: `Panfactum VPC for the ${environment} environment in the ${region} region`,
                  required: true,
                  validate: (value) => {
                    const { error } = VPC_DESCRIPTION.safeParse(value);
                    if (error) {
                      return error.issues[0]?.message ?? "Invalid description";
                    } else {
                      return true;
                    }
                  },
                });
            }
          },
        },
        {
          title: "Get ECR configuration",
          task: async (ctx, task) => {
            const moduleName = "aws_ecr_pull_through_cache";
            const modulePath = path.join(clusterPath, moduleName);
            const secretsPath = path.join(modulePath, "secrets.yaml");

            let ghPAT, dhPAT;

            if (await fileExists(secretsPath)) {
              ({ github_access_token: ghPAT, docker_hub_access_token: dhPAT } =
                await sopsDecrypt({
                  filePath: secretsPath,
                  context,
                  validationSchema: z.object({
                    github_access_token: z.string().optional(),
                    docker_hub_access_token: z.string().optional(),
                  }),
                }));
            }

            const originalInputs = await readYAMLFile({
              filePath: path.join(
                clusterPath,
                MODULES.AWS_ECR_PULL_THROUGH_CACHE,
                "module.yaml"
              ),
              context,
              validationSchema: z
                .object({
                  extra_inputs: z
                    .object({
                      docker_hub_username: z.string().optional(),
                      github_username: z.string().optional(),
                    })
                    .passthrough()
                    .optional()
                    .default({}),
                })
                .passthrough(),
            });

            ctx.dockerHubUsername = originalInputs?.extra_inputs.docker_hub_username;
            ctx.githubUsername = originalInputs?.extra_inputs.github_username;

            if (
              originalInputs?.extra_inputs?.docker_hub_username &&
              originalInputs?.extra_inputs?.github_username &&
              dhPAT &&
              ghPAT
            ) {
              ctx.dockerHubUsername =
                originalInputs.extra_inputs.docker_hub_username;
              ctx.githubUsername = originalInputs.extra_inputs.github_username;
              task.skip("Skip: Already have ECR configuration");
              return;
            }

            if (!ctx.dockerHubUsername) {
              ctx.dockerHubUsername = await task
                .prompt(ListrInquirerPromptAdapter)
                .run(input, {
                  message: applyColors("Enter your Docker Hub username:", { style: "question" }),
                  required: true,
                  validate: (value) => {
                    const { error } = DOCKERHUB_USERNAME.safeParse(value);
                    if (error) {
                      return error.issues[0]?.message ?? "Invalid username";
                    } else {
                      return true;
                    }
                  },
                });
            }

            if (!dhPAT) {
              dhPAT = await task
                .prompt(ListrInquirerPromptAdapter)
                .run(password, {
                  message: applyColors(
                    `Enter your Docker Hub Access Token with 'Public Repo Read-only' permissions\n` +
                    `For more details on how to create one, see our documentation: https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#docker-hub-credentials\n` +
                    `This will be encrypted and stored securely:`,
                    { style: "question", highlights: [{ phrase: "This will be encrypted and stored securely", style: "important" }] }
                  ),
                  mask: true,
                  validate: async (value) => {
                    try {
                      const response = await globalThis.fetch(
                        "https://hub.docker.com/v2/repositories/library/nginx/tags",
                        {
                          headers: {
                            Authorization: `Bearer ${value}`,
                          },
                        }
                      );
                      if (response.status !== 200) {
                        return "This does not appear to be a valid Docker Hub Access Token or the permissions are not correct";
                      }
                      return true;
                    } catch {
                      return "Error validating Docker Hub Access Token, please try again.";
                    }
                  },
                });
              await sopsUpsert({
                values: { docker_hub_access_token: dhPAT },
                context,
                filePath: secretsPath,
              });
            }

            if (!ctx.githubUsername) {
              ctx.githubUsername = await task
                .prompt(ListrInquirerPromptAdapter)
                .run(input, {
                  message: applyColors("Enter your GitHub username:", { style: "question" }),
                  required: true,
                  validate: (value) => {
                    const { error } = GITHUB_USERNAME.safeParse(value);
                    if (error) {
                      return error.issues[0]?.message ?? "Invalid username";
                    } else {
                      return true;
                    }
                  },
                });
            }

            if (!ghPAT) {
              ghPAT = await task
                .prompt(ListrInquirerPromptAdapter)
                .run(password, {
                  message: applyColors(
                    `Enter your classic GitHub Personal Access Token with 'read:packages' scope\n` +
                    `For more details on how to create one, see our documentation: https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#github-credentials\n` +
                    `This will be encrypted and stored securely:`,
                    { style: "question", highlights: [{ phrase: "This will be encrypted and stored securely", style: "important" }] }
                  ),
                  mask: true,
                  validate: async (value) => {
                    try {
                      const response = await globalThis.fetch(
                        "https://api.github.com/user/packages?package_type=container",
                        {
                          headers: {
                            Authorization: `Bearer ${value}`,
                          },
                        }
                      );
                      if (response.status !== 200) {
                        return "This does not appear to be a valid GitHub Personal Access Token or the permissions are not correct";
                      }
                      return true;
                    } catch {
                      return "Error validating GitHub Personal Access Token, please try again.";
                    }
                  },
                });
              await sopsUpsert({
                values: { github_access_token: ghPAT },
                context,
                filePath: secretsPath,
              });
            }
          },
        },
        {
          title: "Deploy the Modules",
          task: async (ctx, parentTask) => {
            return parentTask.newListr<Context>(
              [
                {
                  task: async (ctx, parentTask) => {
                    return parentTask.newListr<Context>(
                      [
                        await buildDeployModuleTask<Context>({
                          taskTitle: "Deploy VPC",
                          context,
                          environment,
                          region,
                          module: MODULES.AWS_VPC,
                          initModule: true,
                          hclIfMissing:
                            await Bun.file(awsVpcTerragruntHcl).text(),
                          inputUpdates: {
                            vpc_name: defineInputUpdate({
                              schema: z.string(),
                              update: (_, ctx) => ctx.vpcName!,
                            }),
                            vpc_description: defineInputUpdate({
                              schema: z.string(),
                              update: (_, ctx) => ctx.vpcDescription!,
                            }),
                          },
                        }),
                        {
                          title: "Run the VPC Network Test",
                          task: async (_, task) => {
                            // TODO: @seth - It would be good if the vpcNetworkTest was a task
                            // so we could see the discrete steps
                            await vpcNetworkTest({
                              awsProfile,
                              context,
                              environment,
                              region,
                              task,
                            });
                          },
                          rendererOptions: {
                            outputBar: 5,
                          },
                        },
                      ],
                      { ctx, concurrent: false }
                    );
                  },
                },
                await buildDeployModuleTask<Context>({
                  taskTitle: "Deploy ECR Pull Through Cache",
                  context,
                  environment,
                  region,
                  module: MODULES.AWS_ECR_PULL_THROUGH_CACHE,
                  initModule: true,
                  hclIfMissing: await Bun.file(
                    awsEcrPullThroughCacheTerragruntHcl
                  ).text(),
                  // TODO: @seth - Interested in your opinion
                  // I don't like `ctx.dockerHubUsername!` even though I've been using it
                  // I think we may want to incorporate some sort of runtime validation here.
                  // as I believe we should be doing EXTREMELY defensive coding
                  // b/c of how annoying it would be for users if something messed up
                  // with a vague error (e.g., dockerHubUsername being undefined accidentally)
                  inputUpdates: {
                    docker_hub_username: defineInputUpdate({
                      schema: z.string(),
                      update: (_, ctx) => ctx.dockerHubUsername!,
                    }),
                    github_username: defineInputUpdate({
                      schema: z.string(),
                      update: (_, ctx) => ctx.githubUsername!,
                    }),
                  },
                }),
              ],
              { ctx, concurrent: true }
            );
          },
        },
        {
          title: "Update Configuration File",
          task: async () => {
            await upsertConfigValues({
              context,
              filePath: path.join(clusterPath, "region.yaml"),
              values: {
                extra_inputs: {
                  pull_through_cache_enabled: true,
                },
              },
            });
          },
        },
      ]);
    },
  });

  try {
    await tasks.run();
  } catch (e) {
    throw new CLIError("Failed to setup VPC", e);
  }
}
