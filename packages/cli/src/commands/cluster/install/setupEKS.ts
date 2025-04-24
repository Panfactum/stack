import path from "node:path";
import { input } from "@inquirer/prompts";
import { Listr } from "listr2";
import pc from "picocolors";
import { z } from "zod";
import awsEksSla1Template from "@/templates/aws_eks_sla_1_terragrunt.hcl" with { type: "file" };
import awsEksSla2Template from "@/templates/aws_eks_sla_2_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { applyColors } from "@/util/colors/applyColors";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { buildSyncAWSIdentityCenterTask } from "@/util/devshell/tasks/syncAWSIdentityCenterTask";
import { CLIError } from "@/util/error/error";
import { MODULES } from "@/util/terragrunt/constants";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { clusterReset } from "../reset/clusterReset";
import type { InstallClusterStepOptions } from "./common";

const CLUSTER_NAME = z
  .string()
  .min(3, "Cluster name must be at least 3 characters long")
  .max(63, "Cluster name must be less than 63 characters long")
  .regex(
    /^[a-z0-9-]+$/,
    "Must only contain the letters a-z (lowercase), numbers 0-9, and hyphens (-)"
  )
  .regex(
    /^[a-z0-9].*[a-z0-9]*$/,
    "Must start and end with a letter a-z (lowercase) or number 0-9"
  );
const CLUSTER_DESCRIPTION = z
  .string()
  .min(3, "Cluster description must be at least 3 characters long")
  .max(255, "Cluster description must be less than 255 characters long")
  .regex(
    /^[a-zA-Z0-9_\- .:/=+@]+$/,
    "Must only contain spaces, the letters a-z (case-insensitive), numbers 0-9, and the following characters: _.:/=+-@"
  )
  .regex(/^(?!aws:).*$/i, "Cannot start with 'AWS:' (case insensitive)");

const clusterNameFormatter = (input: string): string => {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "-");
};

export async function setupEKS(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const { awsProfile, clusterPath, context, environment, region, slaTarget } =
    options;

  const tasks = new Listr([]);

  tasks.add({
    skip: () => completed,
    title: "Setup EKS Kubernetes cluster",
    task: async (ctx, parentTask) => {
      interface Context {
        clusterName?: string;
        clusterDescription?: string;
      }

      return parentTask.newListr<Context>(
        [
          {
            title: "Verify access",
            task: async () => {
              await getIdentity({ context, profile: awsProfile });
            },
          },
          {
            title: "Get EKS configuration",
            task: async (ctx, task) => {
              task.output = applyColors(
                "⏰ NOTE: The cluster may take up to 20 minutes to be created after you answer a couple questions",
                { style: "important" }
              );
              const originalInputs = await readYAMLFile({
                filePath: path.join(
                  clusterPath,
                  MODULES.AWS_EKS,
                  "module.yaml"
                ),
                context,
                validationSchema: z
                  .object({
                    extra_inputs: z
                      .object({
                        cluster_name: z.string().optional(),
                        cluster_description: z.string().optional(),
                      })
                      .passthrough()
                      .optional()
                      .default({}),
                  })
                  .passthrough(),
              });

              if (
                originalInputs?.extra_inputs?.cluster_name &&
                originalInputs?.extra_inputs?.cluster_description
              ) {
                ctx.clusterName = originalInputs.extra_inputs.cluster_name;
                ctx.clusterDescription =
                  originalInputs.extra_inputs.cluster_description;
                task.skip("Already have EKS configuration, skipping...");
                return;
              }

              if (!ctx.clusterName) {
                ctx.clusterName = await input({
                  message: pc.magenta(
                    "Enter a name for your Kubernetes cluster:"
                  ),
                  required: true,
                  default: `${environment}-${region}`,
                  transformer: (value) => clusterNameFormatter(value),
                  validate: (value) => {
                    const transformed = clusterNameFormatter(value);
                    const { error } = CLUSTER_NAME.safeParse(transformed);
                    if (error) {
                      return error.issues[0]?.message ?? "Invalid cluster name";
                    } else {
                      return true;
                    }
                  },
                });
                ctx.clusterName = clusterNameFormatter(ctx.clusterName);
              }

              if (!ctx.clusterDescription) {
                ctx.clusterDescription = await input({
                  message: "Enter a description for your Kubernetes cluster:",
                  required: true,
                  default: `Panfactum Kubernetes cluster in the ${region} region of the ${environment} environment`,
                  validate: (value) => {
                    const { error } = CLUSTER_DESCRIPTION.safeParse(value);
                    if (error) {
                      return (
                        error.issues[0]?.message ??
                        "Invalid cluster description"
                      );
                    } else {
                      return true;
                    }
                  },
                });
              }
            },
          },
          await buildDeployModuleTask<Context>({
            context,
            environment,
            region,
            module: MODULES.AWS_EKS,
            initModule: true,
            hclIfMissing:
              slaTarget === 1 ? awsEksSla1Template : awsEksSla2Template,
            inputUpdates: {
              "inputs.cluster_name": defineInputUpdate({
                schema: z.string(),
                update: (_, ctx) => ctx.clusterName!,
              }),
              "inputs.cluster_description": defineInputUpdate({
                schema: z.string(),
                update: (_, ctx) => ctx.clusterDescription!,
              }),
            },
          }),
          {
            title: "Reset the cluster",
            task: async (ctx, task) => {
              await clusterReset({
                awsProfile,
                clusterName: ctx.clusterName!,
                context,
                region,
                task,
              });
            },
            rendererOptions: {
              outputBar: 5,
            },
          },
          {
            title: "Update the Kubernetes configuration files",
            task: async () => {
              // TODO: @seth confirm this is the correct task to use
              await buildSyncAWSIdentityCenterTask({
                context,
              });
            },
          },
          {
            title: "Update Configuration File",
            task: async (ctx) => {
              await upsertConfigValues({
                context,
                filePath: path.join(clusterPath, "region.yaml"),
                values: {
                  kube_config_context: ctx.clusterName!,
                  kube_api_server: "", // FIX: @jack
                },
              });
            },
          },
        ],
        { ctx }
      );
    },
  });

  try {
    await tasks.run();
  } catch (e) {
    throw new CLIError("Failed to setup EKS", e);
  }
}
