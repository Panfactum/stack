import path from "node:path";
import { input } from "@inquirer/prompts";
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { Listr } from "listr2";
import pc from "picocolors";
import { z } from "zod";
import awsEksSla1Template from "@/templates/aws_eks_sla_1_terragrunt.hcl" with { type: "file" };
import awsEksSla2Template from "@/templates/aws_eks_sla_2_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { applyColors } from "@/util/colors/applyColors";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import {
  buildSyncKubeClustersTask,
  EKS_MODULE_OUTPUT_SCHEMA,
} from "@/util/devshell/tasks/syncKubeClustersTask";
import { CLIError } from "@/util/error/error";
import { MODULES } from "@/util/terragrunt/constants";

import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
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
              const prompt = task.prompt(ListrInquirerPromptAdapter);

              // TODO: @seth - It feels like we should only present this warning AFTER they have
              // already entered all the info
              task.output = applyColors(
                "⏰ NOTE: The cluster may take up to 20 minutes to be created after you answer a couple questions",
                { style: "important" }
              );

              // TODO: @seth - It feels like we should have a helper fx
              // for the action of "reading inputs from module.yaml"
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
              ctx.clusterName = originalInputs?.extra_inputs.cluster_name;
              ctx.clusterDescription =
                originalInputs?.extra_inputs.cluster_description;

              if (
                ctx.clusterName &&
                ctx.clusterDescription
              ) {
                task.skip("Already have EKS configuration, skipping...");
                return;
              }

              if (!ctx.clusterName) {
                ctx.clusterName = await prompt.run(input, {
                  message: pc.magenta(
                    "Enter a name for your Kubernetes cluster:"
                  ),
                  required: true,
                  default: `${environment}-${region}`, // FIX: @seth - Need to validate whether this default is ok
                  transformer: (value) => clusterNameFormatter(value), // TODO: @seth - Do we want to do this?
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
                ctx.clusterDescription = await prompt.run(input, {
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
            hclIfMissing: await (slaTarget === 1
              ? Bun.file(awsEksSla1Template).text()
              : Bun.file(awsEksSla2Template).text()), // TODO: @seth - Does it make sense to have two templates?
            inputUpdates: {
              cluster_name: defineInputUpdate({
                schema: z.string(),
                update: (_, ctx) => ctx.clusterName!,
              }),
              cluster_description: defineInputUpdate({
                schema: z.string(),
                update: (_, ctx) => ctx.clusterDescription!,
              }),
              // TODO: @jack - Move to region.yaml
              bootstrap_mode_enabled: defineInputUpdate({
                schema: z.boolean(),
                update: () => true,
              }),
            },
          }),
          await buildSyncKubeClustersTask({
            context,
          }),
          {
            title: "Reset the cluster",
            task: async (ctx, task) => {
              // TODO: @seth - Would be good if this was isn't own subtask
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
            title: "Update Configuration File",
            task: async (ctx) => {

              // TODO: @seth - This is unnecessary
              // as we can read from `.kube/clusters.yaml
              const moduleOutput = await terragruntOutput({
                context,
                environment,
                region,
                module: MODULES.AWS_EKS,
                validationSchema: EKS_MODULE_OUTPUT_SCHEMA,
              });
              
              await upsertConfigValues({
                context,
                filePath: path.join(clusterPath, "region.yaml"),
                values: {
                  kube_config_context: ctx.clusterName!,
                  kube_api_server: moduleOutput.cluster_url.value,
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
