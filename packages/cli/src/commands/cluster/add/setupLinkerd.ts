import { join } from "node:path";
import { z } from "zod";
import kubeLinkerdTerragruntHcl from "@/templates/kube_linkerd_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { execute } from "@/util/subprocess/execute";
import { killBackgroundProcess } from "@/util/subprocess/killBackgroundProcess";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask } from "@/util/terragrunt/tasks/deployModuleTask";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupLinkerd(
  options: InstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, context, environment, clusterPath, kubeConfigContext, region } = options;


  const { root_token: vaultRootToken } = await sopsDecrypt({
    filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
    context,
    validationSchema: z.object({
      root_token: z.string(),
    }),
  });

  interface Context {
    vaultProxyPid?: number;
    vaultProxyPort?: number;
  }

  const tasks = mainTask.newListr<Context>([
    {
      title: "Verify access",
      task: async () => {
        await getIdentity({ context, profile: awsProfile });
      },
    },
    {
      title: "Start Vault Proxy",
      task: async (ctx) => {
        const { pid, port } = await startVaultProxy({
          env: {
            ...process.env,
            VAULT_TOKEN: vaultRootToken,
          },
          modulePath: join(clusterPath, MODULES.KUBE_LINKERD),
        });
        ctx.vaultProxyPid = pid;
        ctx.vaultProxyPort = port;
      },
    },
    {
      task: async (ctx, task) => {
        return task.newListr<Context>(
          [
            await buildDeployModuleTask({
              taskTitle: "Deploy Linkerd Service Mesh",
              context,
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken,
              },
              environment,
              region,
              module: MODULES.KUBE_LINKERD,
              initModule: true,
              hclIfMissing: await Bun.file(kubeLinkerdTerragruntHcl).text(),
            }),
          ],
          { ctx }
        );
      },
    },
    {
      title: "Set Kubernetes Context",
      task: async () => {
        if (!kubeConfigContext) {
          throw new CLIError("Kube config context is not set");
        }
        await execute({
          command: ["kubectl", "config", "use-context", kubeConfigContext],
          context,
          workingDirectory: join(clusterPath, MODULES.KUBE_LINKERD),
          errorMessage: "Failed to set Kubernetes context for Linkerd control plane checks",
        });
      },
    },
    // TODO: @seth - How to resume from here if this fails?
    {
      title: "Run Linkerd Control Plane Checks",
      task: async (ctx, task) => {
        await execute({
          command: ["linkerd", "check", "--cni-namespace=linkerd"],
          context,
          workingDirectory: join(clusterPath, MODULES.KUBE_LINKERD),
          errorMessage: "Linkerd control plane checks failed",
          isSuccess: ({ exitCode, stdout }) =>
            exitCode === 0 ||
            (stdout as string).includes("Status check results are √"),
          env: {
            ...process.env,
            VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
            VAULT_TOKEN: vaultRootToken,
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
          killBackgroundProcess({ pid: ctx.vaultProxyPid, context });
        }
      },
    },
  ]);

  return tasks;
}
