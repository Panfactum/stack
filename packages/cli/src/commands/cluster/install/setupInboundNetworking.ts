import { join } from "node:path";
import { Listr } from "listr2";
import { z } from "zod";
import kubeNginxIngressTerragruntHcl from "@/templates/kube_ingress_nginx_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { CLIError } from "@/util/error/error";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { execute } from "@/util/subprocess/execute";
import { killBackgroundProcess } from "@/util/subprocess/killBackgroundProcess";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { MODULES } from "@/util/terragrunt/constants";
import {
  buildDeployModuleTask,
  defineInputUpdate,
} from "@/util/terragrunt/tasks/deployModuleTask";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import type { InstallClusterStepOptions } from "./common";

export async function setupInboundNetworking(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const {
    awsProfile,
    context,
    environment,
    environmentDomain,
    clusterPath,
    region,
    slaTarget,
  } = options;

  const tasks = new Listr([]);

  const { root_token: vaultRootToken } = await sopsDecrypt({
    filePath: join(clusterPath, MODULES.KUBE_INGRESS_NGINX, "secrets.yaml"),
    context,
    validationSchema: z.object({
      root_token: z.string(),
    }),
  });

  tasks.add({
    skip: () => completed,
    title: "Deploy Inbound Networking",
    task: async (_, parentTask) => {
      interface Context {
        vaultDomain?: string;
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
              modulePath: join(clusterPath, MODULES.KUBE_CERT_MANAGER),
            });
            ctx.vaultProxyPid = pid;
            ctx.vaultProxyPort = port;
          },
        },
        {
          title: "Generating a key used for TLS security",
          task: async () => {
            const { stdout } = await execute({
              command: ["openssl", "dhparam", "-dsaparam", "4096"],
              context,
              workingDirectory: clusterPath,
            });

            const secretsPath = join(
              join(clusterPath, MODULES.KUBE_INGRESS_NGINX),
              "secrets.yaml"
            );

            // TODO: @seth Check if this works with this multi-line string
            await sopsUpsert({
              context,
              filePath: secretsPath,
              values: { dhparam: stdout },
            });
          },
        },
        {
          task: async (ctx) => {
            await buildDeployModuleTask({
              context,
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken,
              },
              environment,
              region,
              module: MODULES.KUBE_INGRESS_NGINX,
              initModule: true,
              hclIfMissing: await Bun.file(
                kubeNginxIngressTerragruntHcl
              ).text(),
              inputUpdates: {
                ingress_domains: defineInputUpdate({
                  schema: z.array(z.string()),
                  update: () => [environmentDomain],
                }),
                sla_level: defineInputUpdate({
                  schema: z.number(),
                  update: () => slaTarget,
                }),
              },
            });
          },
        },
        {
          task: async (ctx) => {
            await buildDeployModuleTask({
              context,
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken,
              },
              environment,
              region,
              module: MODULES.KUBE_VAULT,
              inputUpdates: {
                ingress_enabled: defineInputUpdate({
                  schema: z.boolean(),
                  update: () => true,
                }),
              },
            });
          },
        },
        {
          title: "Verifying the Vault Ingress",
          task: async (ctx) => {
            const moduleDir = join(
              context.repoVariables.environments_dir,
              environment,
              region,
              MODULES.KUBE_VAULT
            );
            const moduleYAMLPath = join(moduleDir, "module.yaml");
            const data = await readYAMLFile({
              filePath: moduleYAMLPath,
              context,
              validationSchema: z.object({
                vault_addr: z.string(),
              }),
              throwOnMissing: true,
            });

            ctx.vaultDomain = data!.vault_addr;

            await execute({
              command: ["delv", "@1.1.1.1", data!.vault_addr],
              context,
              workingDirectory: join(clusterPath, MODULES.KUBE_VAULT),
              retries: 30,
              retryDelay: 10000,
              isSuccess: ({ stdout }) => {
                return (
                  (stdout as string).includes("; fully validated") &&
                  !(stdout as string).includes(
                    "; negative response, fully validated"
                  )
                );
              },
            });
          },
        },
        {
          title: "Updating the Vault Address",
          task: async (ctx) => {
            await upsertConfigValues({
              context,
              filePath: join(clusterPath, "region.yaml"),
              values: {
                vault_addr: `https://${ctx.vaultDomain}`,
              },
            });

            await buildDeployModuleTask({
              context,
              environment,
              region,
              module: MODULES.VAULT_CORE_RESOURCES,
              initModule: false,
            });
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
    throw new CLIError("Failed to deploy Inbound Networking", e);
  }
}
