import path from "node:path";
import { z } from "zod";
import awsVpcTerragruntHcl from "@/templates/aws_vpc_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { vpcNetworkTest } from "@/util/aws/vpcNetworkTest";
import { parseErrorHandler } from "@/util/error/parseErrorHandler";
import { execute } from "@/util/subprocess/execute";
import { MODULES } from "@/util/terragrunt/constants";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

const DESCRIBE_VPCS_SCHEMA = z.object({
  Vpcs: z.array(z.object({})),
});

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

export async function setupVPC(
  options: InstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, context, environment, clusterPath, region, awsRegion } = options;

  interface Context {
    vpcName?: string;
    vpcDescription?: string;
    dockerHubUsername?: string;
    githubUsername?: string;
  }

  const tasks = mainTask.newListr<Context>([
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

        ctx.vpcName = await context.logger.input({
          task,
          message: "Enter a name for your VPC:",
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
                `--region=${awsRegion}`,
                `--filters=Name=tag:Name,Values=${value}`,
                "--output=json",
                `--profile=${awsProfile}`,
                "--no-cli-pager",
              ];

              const { stdout } = await execute({
                command: vpcListCommand,
                context: context,
                workingDirectory: clusterPath,
              });
              let vpcList;
              try {
                const vpc = JSON.parse(stdout);
                vpcList = DESCRIBE_VPCS_SCHEMA.parse(vpc);
              } catch (error) {
                throw parseErrorHandler({
                  error,
                  errorMessage:
                    "Failed checking if VPC name is already in use.",
                  location: vpcListCommand.join(" "),
                });
              }

              if (vpcList.Vpcs.length > 0) {
                return `A VPC already exists in AWS with the name ${value}. Please choose a different name.`;
              } else {
                return true;
              }
            }
          },
        });
        ctx.vpcDescription = await context.logger.input({
          task,
          message: "Enter a description for your VPC:",
          default: `Panfactum VPC for the ${environment} environment in the ${region} region`,
          required: true,
          validate: async (value) => {
            const { error } = VPC_DESCRIPTION.safeParse(value);
            if (error) {
              return error.issues[0]?.message ?? "Invalid description";
            } else {
              return true;
            }
          },
        });
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
                      skipIfAlreadyApplied: true,
                      module: MODULES.AWS_VPC,
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
          ],
          { ctx, concurrent: true }
        );
      },
    },
  ])

  return tasks;
}
