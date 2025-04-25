import { join } from "node:path";
import { Listr } from "listr2";
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

export async function setupLinkerd(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const { awsProfile, context, environment, clusterPath, region } = options;

  const tasks = new Listr([]);

  const { root_token: vaultRootToken } = await sopsDecrypt({
    filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
    context,
    validationSchema: z.object({
      root_token: z.string(),
    }),
  });

  tasks.add({
    skip: () => completed,
    title: "Deploy Linkerd Service Mesh",
    task: async (_, parentTask) => {
      interface Context {
        vaultProxyPid?: number;
        vaultProxyPort?: number;
      }
      return parentTask.newListr<Context>([
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
          title: "Run Linkerd Control Plane Checks",
          task: async (ctx, task) => {
            await execute({
              task,
              command: ["linkerd", "check", "--cni-namespace=linkerd"],
              context,
              workingDirectory: process.cwd(),
              errorMessage: "Linkerd control plane checks failed",
              isSuccess: ({ exitCode, stdout }) =>
                exitCode === 0 ||
                (stdout as string).includes("Status check results are √"),
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken,
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
    },
  });

  try {
    await tasks.run();
  } catch (e) {
    throw new CLIError("Failed to deploy Linkerd Service Mesh", e);
  }
}
