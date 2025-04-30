import { join } from "node:path";
import { AppsV1Api, CustomObjectsApi, KubeConfig } from "@kubernetes/client-node";
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

const CERTIFICATES_SCHEMA = z.object({
  body: z.object({
    items: z.array(z.object({
      metadata: z.object({
        labels: z.record(z.string(), z.string()),
      }),
      status: z.object({
        conditions: z.array(z.object({
          type: z.string(),
          status: z.string()
        }))
      })
    }))
  })
})

export async function setupInboundNetworking(
  options: InstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const {
    awsProfile,
    context,
    environment,
    clusterPath,
    kubeConfigContext,
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
            {
              task: async (ctx, task) => {
                return task.newListr<Context>([
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
                  {
                    title: "Resetting Cert Manager",
                    task: async () => {
                      let attempts = 0;
                      const maxAttempts = 10;
                      const retryDelay = 90000;

                      const kc = new KubeConfig();
                      kc.loadFromDefault();
                      if (!kubeConfigContext) {
                        throw new CLIError("Kube config context not found");
                      }
                      kc.setCurrentContext(kubeConfigContext);

                      const customApi = kc.makeApiClient(CustomObjectsApi);
                      const appsApi = kc.makeApiClient(AppsV1Api);

                      while (attempts < maxAttempts) {
                        // Doing this up front to wait the first time
                        await new Promise(resolve => globalThis.setTimeout(resolve, retryDelay));

                        try {
                          // Get Certificate resources
                          const result = await customApi.listClusterCustomObject({
                            group: 'cert-manager.io',
                            version: 'v1',
                            plural: 'certificates'
                          });

                          const parsedResult = CERTIFICATES_SCHEMA.safeParse(result);

                          if (parsedResult.success) {
                            const certificates = parsedResult.data.body.items || [];
                            const nginxIngressCertificate = certificates.find((cert) => {
                              return cert.metadata.labels['panfactum.com/root-module'] === 'kube_ingress_nginx';
                            });

                            if (nginxIngressCertificate) {
                              const isCertReady = nginxIngressCertificate.status.conditions.some((condition) => {
                                return condition.type === 'Ready' && condition.status === 'True';
                              });

                              if (isCertReady) {
                                return;
                              }
                            }
                          }

                          // Restart cert-manager deployment
                          await appsApi.patchNamespacedDeployment({
                            name: 'cert-manager',
                            namespace: 'cert-manager',
                            body: {
                              spec: {
                                template: {
                                  metadata: {
                                    annotations: {
                                      'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
                                    }
                                  }
                                }
                              }
                            },
                          });

                          attempts++;
                        } catch (error) {
                          throw new CLIError(`Failed to restart cert-manager`, error);
                        }
                      }
                      throw new CLIError(`Failed to progress after resetting cert-manager ${maxAttempts} times`);
                    }
                  }
                ], { ctx, concurrent: true })
              }
            },
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

        task.output = context.logger.applyColors(`WARNING: This might take 10-30 minutes to complete while DNS propagates.`, { style: 'warning' })

        let attempts = 0;
        const maxAttempts = 180;
        const retryDelay = 10000;

        while (attempts < maxAttempts) {
          try {
            let statusStr = `${attempts + 1}/${maxAttempts}`
            task.title = context.logger.applyColors(`Polling Vault health endpoint ${statusStr}`, { lowlights: [statusStr] });
            const response = await Bun.fetch(`https://${data.extra_inputs.vault_domain}/v1/sys/health`);

            if (response.status === 200) {
              task.title = context.logger.applyColors("Vault health check successful");
              break;
            }

            statusStr = `- Waiting 10 seconds for Vault to be ready... ${attempts + 1}/${maxAttempts}`
            task.title = context.logger.applyColors(` Polling Vault health endpoint ${statusStr}`, { lowlights: [statusStr] });
          } catch {
            const statusStr = `- Waiting 10 seconds for DNS to propagate... ${attempts + 1}/${maxAttempts}`
            task.title = context.logger.applyColors(` Polling Vault health endpoint ${statusStr}`, { lowlights: [statusStr] });
            // Expected to error while waiting for DNS to propagate
          }
          attempts++;

          if (attempts < maxAttempts) {
            await new Promise(resolve => globalThis.setTimeout(resolve, retryDelay));
          } else {
            task.title = context.logger.applyColors(`Failed to connect to Vault health endpoint after ${maxAttempts} attempts`, { style: "error" });
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
