import { join } from "node:path";
import { z } from "zod";
import awsLbController from "@/templates/kube_aws_lb_controller_terragrunt.hcl" with { type: "file" };
import kubeExternalDnsTerragruntHcl from "@/templates/kube_external_dns_terragrunt.hcl" with { type: "file" };
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
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupInboundNetworking(
  options: InstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const {
    awsProfile,
    context,
    environment,
    clusterPath,
    region,
    slaTarget
  } = options;


  const { root_token: vaultRootToken } = await sopsDecrypt({
    filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
    context,
    validationSchema: z.object({
      root_token: z.string(),
    }),
  });

  const kubeDomain = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_domain: z.string() }) }).then((data) => data!.kube_domain);

  interface Context {
    vaultDomain?: string;
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

        await sopsUpsert({
          context,
          filePath: secretsPath,
          values: { dhparam: stdout },
        });
      },
    },
    {
      task: async (ctx, task) => {
        return task.newListr<Context>(
          [
            await buildDeployModuleTask({
              taskTitle: "Deploy AWS Load Balancer Controller",
              context,
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken,
              },
              environment,
              region,
              module: MODULES.KUBE_AWS_LB_CONTROLLER,
              initModule: true,
              hclIfMissing: await Bun.file(awsLbController).text(),
              // TODO: @jack - This should come from the aws_eks module
              inputUpdates: {
                subnets: defineInputUpdate({
                  schema: z.array(z.string()),
                  update: () =>
                    slaTarget === 1
                      ? ["PUBLIC_A", "PUBLIC_B"]
                      : ["PUBLIC_A", "PUBLIC_B", "PUBLIC_C"],
                }),
              },
            }),
            await buildDeployModuleTask({
              taskTitle: "Deploy External DNS",
              context,
              env: {
                ...process.env,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
                VAULT_TOKEN: vaultRootToken,
              },
              environment,
              region,
              module: MODULES.KUBE_EXTERNAL_DNS,
              initModule: true,
              hclIfMissing: await Bun.file(
                kubeExternalDnsTerragruntHcl
              ).text(),
            }),
            await buildDeployModuleTask({
              taskTitle: "Deploy Ingress NGINX",
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
                  update: () => [kubeDomain],
                }),
                sla_level: defineInputUpdate({
                  schema: z.number(),
                  update: () => 1,
                }),
              },
              postDeployInputUpdates: {
                sla_level: defineInputUpdate({
                  schema: z.number().optional(),
                  update: () => undefined,
                })
              }
            }),
            await buildDeployModuleTask({
              taskTitle: "Update Vault to use Ingress",
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
            }),
          ],
          { ctx }
        );
      },
    },
    {
      title: "Verifying the Vault Ingress",
      task: async (ctx, task) => {
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
            extra_inputs: z.object({
              ingress_enabled: z.boolean(),
              vault_domain: z.string(),
              wait: z.boolean(),
            }),
          }),
          throwOnMissing: true,
        });

        if (!data?.extra_inputs.vault_domain) {
          throw new CLIError("Vault domain not found in the module.yaml file");
        }

        ctx.vaultDomain = data.extra_inputs.vault_domain;

        let attempts = 0;
        const maxAttempts = 60;
        const retryDelay = 10000;

        // FIX: @seth - Logging here doesn't make sense
        // overwrites itself too fast
        while (attempts < maxAttempts) {
          try {
            task.output = context.logger.applyColors(`Checking Vault health endpoint (attempt ${attempts + 1}/${maxAttempts})`, { style: "subtle" });
            const response = await Bun.fetch(
              `https://${data.extra_inputs.vault_domain}/v1/sys/health`
            );

            if (response.status === 200) {
              task.output = context.logger.applyColors("Vault health check successful", { style: "subtle" });
              break;
            }

            task.output = context.logger.applyColors(`Vault health check failed with status: ${response.status}`, { style: "subtle" });
          } catch {
            // Expected to error while waiting for DNS to propagate
          }
          attempts++;

          if (attempts < maxAttempts) {
            task.output = context.logger.applyColors(`Retrying in ${retryDelay / 1000} seconds...`, { style: "subtle" });
            await new Promise(resolve => globalThis.setTimeout(resolve, retryDelay));
          } else {
            throw new CLIError(`Failed to connect to Vault health endpoint after ${maxAttempts} attempts`);
          }
        }
      },
      rendererOptions: {
        outputBar: 5,
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
      },
    },
    await buildDeployModuleTask({
      taskTitle: "Deploy Vault Core Resources with permanent Vault Address",
      context,
      environment,
      region,
      module: MODULES.VAULT_CORE_RESOURCES,
      initModule: false,
      env: {
        ...process.env, //TODO: @seth Use context.env
        VAULT_TOKEN: vaultRootToken,
      },
    }),
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
