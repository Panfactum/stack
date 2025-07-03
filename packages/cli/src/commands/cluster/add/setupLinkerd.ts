import { join } from "node:path";
import { z } from "zod";
import kubeLinkerdTerragruntHcl from "@/templates/kube_linkerd_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { execute } from "@/util/subprocess/execute";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask } from "@/util/terragrunt/tasks/deployModuleTask";
import { startVaultProxy } from "@/util/vault/startVaultProxy";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import type { IInstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupLinkerd(
  options: IInstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, context, environment, clusterPath, region } = options;

  interface IContext {
    kubeContext?: string;
    vaultProxyPid?: number;
    vaultProxyPort?: number;
  }

  const tasks = mainTask.newListr<IContext>([
    {
      title: "Verify access",
      task: async (ctx) => {
        await getIdentity({ context, profile: awsProfile });
        const regionConfig = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_config_context: z.string() }) });
        ctx.kubeContext = regionConfig?.kube_config_context;
        if (!ctx.kubeContext) {
          throw new CLIError("Kube context not found");
        }
      },
    },
    {
      title: "Start Vault Proxy",
      task: async (ctx) => {
        if (!ctx.kubeContext) {
          throw new CLIError("Kube context not found");
        }

        const { pid, port } = await startVaultProxy({
          context,
          env: {
            ...process.env,
          },
          kubeContext: ctx.kubeContext,
          modulePath: join(clusterPath, MODULES.KUBE_LINKERD),
        });
        ctx.vaultProxyPid = pid;
        ctx.vaultProxyPort = port;
      },
    },
    {
      task: async (ctx, task) => {
        return task.newListr<IContext>(
          [
            await buildDeployModuleTask({
              taskTitle: "Deploy Linkerd Service Mesh",
              context,
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
              },
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.KUBE_LINKERD,
              hclIfMissing: await Bun.file(kubeLinkerdTerragruntHcl).text(),
            }),
          ],
          { ctx }
        );
      },
    },
    // TODO: @seth - How to resume from here if this fails?
    {
      title: "Run Linkerd Control Plane Checks",
      task: async (ctx, task) => {
        const regionConfig = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_config_context: z.string() }) });
        const kubeContext = regionConfig?.kube_config_context;
        if (!kubeContext) {
          throw new CLIError("Kube context not found");
        }
        await execute({
          command: ["linkerd", "check", "--cni-namespace=linkerd", "--context", kubeContext],
          context,
          workingDirectory: join(clusterPath, MODULES.KUBE_LINKERD),
          errorMessage: "Linkerd control plane checks failed",
          isSuccess: ({ exitCode, stdout }) =>
            exitCode === 0 ||
            stdout.includes("Status check results are √"),
          env: {
            ...process.env,
            VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
          },
          onStdOutNewline: (line) => {
            task.output = context.logger.applyColors(line, { style: "subtle", highlighterDisabled: true });
          },
          onStdErrNewline: (line) => {
            task.output = context.logger.applyColors(line, { style: "subtle", highlighterDisabled: true });
          },
        });
      },
      rendererOptions: {
        outputBar: 5,
      },
    },
    {
      title: "Stop Vault Proxy",
      task: async (ctx) => {
        if (ctx.vaultProxyPid) {
          await context.backgroundProcessManager.killProcess({ pid: ctx.vaultProxyPid });
        }
      },
    },
  ]);

  return tasks;
}
