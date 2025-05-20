import path from "node:path";
import { z } from "zod";
import awsEksTemplate from "@/templates/aws_eks.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import {
  buildSyncKubeClustersTask,
  EKS_MODULE_OUTPUT_SCHEMA,
} from "@/util/devshell/tasks/syncKubeClustersTask";
import { MODULES } from "@/util/terragrunt/constants";

import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { clusterReset } from "../reset/clusterReset";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

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
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, clusterPath, context, environment, region, awsRegion, slaTarget } =
    options;

  interface Context {
    clusterName?: string;
    clusterDescription?: string;
    callerArn?: string;
    isSSO?: boolean;
  }


  const tasks = mainTask.newListr<Context>([
    {
      title: "Verify access",
      task: async (ctx) => {
        const { Arn: arn } = await getIdentity({ context, profile: awsProfile });
        ctx.callerArn = arn;
        ctx.isSSO = arn?.includes("AWSReservedSSO");
      },
    },
    {
      title: "Get EKS configuration",
      task: async (ctx, task) => {

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
          ctx.clusterName = await context.logger.input({
            task,
            message: "Cluster name:",
            default: clusterNameFormatter(`${environment}-${region}`),
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
          ctx.clusterDescription = await context.logger.input({
            task,
            message: "Cluster description:",
            default: `Panfactum cluster in the ${region} region of the ${environment} environment`,
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
      taskTitle: "Deploy EKS",
      context,
      environment,
      region,
      skipIfAlreadyApplied: true,
      module: MODULES.AWS_EKS,
      hclIfMissing: await Bun.file(awsEksTemplate).text(),
      inputUpdates: {
        extra_superuser_principal_arns: defineInputUpdate({
          schema: z.array(z.string()),
          update: (_, ctx) => ctx.isSSO ? [] : [ctx.callerArn!]
        }),
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
        node_subnets: defineInputUpdate({
          schema: z.array(z.string()),
          update: () => slaTarget === 1 ? ["PRIVATE_A"] : ["PRIVATE_A", "PRIVATE_B", "PRIVATE_C"],
        }),
      },
      etaWarningMessage: 'This may take up to 15 minutes.',
    }),
    await buildSyncKubeClustersTask({
      context,
    }),
    {
      title: "Reset the cluster",
      task: async (ctx, task) => {
        // TODO: @seth - Would be good if this had its own subtask
        await clusterReset({
          awsProfile,
          clusterName: ctx.clusterName!,
          context,
          awsRegion,
          task,
          clusterPath
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
          environment,
          region,
          values: {
            kube_config_context: ctx.clusterName!,
            kube_api_server: moduleOutput.cluster_url.value,
          },
        });
      },
    },
  ]);

  return tasks;
}
