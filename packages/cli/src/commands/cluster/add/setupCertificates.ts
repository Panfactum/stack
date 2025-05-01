import path, { join } from "node:path";
import { z } from "zod";
import kubeCertIssuersTerragruntHcl from "@/templates/kube_cert_issuers_terragrunt.hcl" with { type: "file" };
import kubeCertManagerTemplate from "@/templates/kube_cert_manager_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
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

export async function setupCertificates(
  options: InstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, clusterPath, context, domains, environment, region } = options;

  const kubeDomain = await readYAMLFile({ filePath: join(clusterPath, "region.yaml"), context, validationSchema: z.object({ kube_domain: z.string() }) }).then((data) => data!.kube_domain);

  const { root_token: vaultRootToken } = await sopsDecrypt({
    filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
    context,
    validationSchema: z.object({
      root_token: z.string(),
    }),
  });

  interface Context {
    alertEmail?: string;
    route53Zones?: string[];
    productionEnvironment?: boolean;
    vaultProxyPid?: number;
    vaultProxyPort?: number;
    kubeContext?: string;
  }

  const tasks = mainTask.newListr<Context>([
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
      title: "Get Certificates Configuration",
      task: async (ctx, task) => {
        const originalInputs = await readYAMLFile({
          throwOnEmpty: false,
          filePath: path.join(
            clusterPath,
            MODULES.KUBE_CERT_ISSUERS,
            "module.yaml"
          ),
          context,
          validationSchema: z
            .object({
              extra_inputs: z
                .object({
                  alert_email: z.string().optional(),
                  route53_zones: z
                    .record(
                      z.string(),
                      z.object({
                        zone_id: z.string(),
                        record_manager_role_arn: z.string(),
                      })
                    )
                    .optional(),
                })
                .passthrough()
                .optional()
                .default({}),
            })
            .passthrough(),
        });

        if (originalInputs?.extra_inputs?.alert_email) {
          ctx.alertEmail = originalInputs.extra_inputs.alert_email;
          task.skip(
            "Already have Certificates configuration, skipping..."
          );
          return;
        }

        // TODO: @seth - Just make this the account contact email
        // let's us remove another user input
        ctx.alertEmail = await context.logger.input({
          task,
          explainer: `
            This email will receive notifications if your certificates fail to renew.
            Enter an email that is actively monitored to prevent unexpected service disruptions.
          `,
          message: "Email:",
          validate: (value: string) => {
            const { error } = z.string().email().safeParse(value);
            if (error) {
              return error.issues?.[0]?.message || "Please enter a valid email address";
            }

            return true;
          }
        })
      }
    },
    {
      title: "Start Vault Proxy",
      task: async (ctx) => {
        const { pid, port } = await startVaultProxy({
          env: {
            ...process.env,
            VAULT_TOKEN: vaultRootToken,
          },
          kubeContext: ctx.kubeContext!,
          modulePath: join(clusterPath, MODULES.KUBE_CERT_ISSUERS),
        });
        ctx.vaultProxyPid = pid;
        ctx.vaultProxyPort = port;
      },
    },
    {
      task: async (ctx, parentTask) => {
        return parentTask.newListr([
          await buildDeployModuleTask({
            taskTitle: "Deploy Certificate Manager",
            context,
            env: {
              ...process.env,
              VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
              VAULT_TOKEN: vaultRootToken,
            },
            environment,
            region,
            skipIfAlreadyApplied: true,
            module: MODULES.KUBE_CERT_MANAGER,
            initModule: true,
            hclIfMissing: await Bun.file(kubeCertManagerTemplate).text(),
            inputUpdates: {
              self_generated_certs_enabled: defineInputUpdate({
                schema: z.boolean(),
                update: () => true,
              }),
            },
          })
        ])
      }
    },
    {
      task: async (ctx, parentTask) => {
        return parentTask.newListr<Context>(
          [
            await buildDeployModuleTask<Context>({
              taskTitle: "Deploy Certificate Issuers",
              context,
              env: {
                ...process.env,
                VAULT_TOKEN: vaultRootToken,
                VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
              },
              environment,
              region,
              skipIfAlreadyApplied: true,
              module: MODULES.KUBE_CERT_ISSUERS,
              initModule: true,
              hclIfMissing: await Bun.file(kubeCertIssuersTerragruntHcl).text(),
              inputUpdates: {
                alert_email: defineInputUpdate({
                  schema: z.string(),
                  update: (_, ctx) => ctx.alertEmail!,
                }),
                route53_zones: defineInputUpdate({
                  schema: z
                    .record(
                      z.string(),
                      z.object({
                        zone_id: z.string(),
                        record_manager_role_arn: z.string(),
                      })
                    )
                    .optional(),
                  update: () => domains,
                }),
                kube_domain: defineInputUpdate({
                  schema: z.string(),
                  update: () => kubeDomain,
                }),
              },
            }),
            {
              title: "Resetting Cert Manager",
              task: async (_, task) => {
                let attempts = 0;
                const maxAttempts = 10;
                const retryDelay = 90000;

                while (attempts < maxAttempts) {
                  // Doing this up front to wait the first time
                  await new Promise(resolve => globalThis.setTimeout(resolve, retryDelay));

                  const statusStr = `attempt ${attempts + 1}/${maxAttempts}`
                  task.title = context.logger.applyColors(`Resetting Cert Manager ${statusStr}`, { lowlights: [statusStr] });

                  let result;
                  try {
                    const { stdout } = await execute({
                      command: ["kubectl", "get", "certificates", "-n", "cert-manager", "-o", "json"],
                      context,
                      workingDirectory: clusterPath,
                    });
                    result = JSON.parse(stdout);
                  } catch (error) {
                    throw new CLIError(`Failed to get certificates`, error);
                  }

                  const parsedResult = CERTIFICATES_SCHEMA.safeParse(result);

                  if (parsedResult.error) {
                    throw new CLIError(`Failed to parse certificates`, parsedResult.error);
                  }

                  if (parsedResult.success) {
                    const certificates = parsedResult.data.items;
                    const ingressCertificate = certificates.find((cert) => {
                      return cert.metadata.labels['panfactum.com/root-module'] === 'kube_cert_issuers';
                    });

                    if (ingressCertificate) {
                      const isCertReady = ingressCertificate.status.conditions.some((condition) => {
                        return condition.type === 'Ready' && condition.status === 'True';
                      });

                      if (isCertReady) {
                        return;
                      }
                    }
                  }

                  try {
                    await execute({
                      command: ["kubectl", "rollout", "restart", "deployment", "-n", "cert-manager"],
                      context,
                      workingDirectory: clusterPath,
                    });

                    attempts++;
                  } catch (error) {
                    throw new CLIError(`Failed to restart cert-manager deployment`, error);
                  }
                }
                throw new CLIError(`Failed to progress after resetting cert-manager ${maxAttempts} times`);
              },
            },
          ],
          { ctx, concurrent: true }
        );
      },
    },
    {
      task: async (ctx, parentTask) => {
        return parentTask.newListr([
          await buildDeployModuleTask<Context>({
            taskTitle: "Deploy The First Certificate",
            context,
            env: {
              ...process.env,
              VAULT_TOKEN: vaultRootToken,
              VAULT_ADDR: `http://127.0.0.1:${ctx.vaultProxyPort}`,
            },
            environment,
            region,
            skipIfAlreadyApplied: false,
            module: MODULES.KUBE_CERT_MANAGER,
            initModule: false,
            inputUpdates: {
              self_generated_certs_enabled: defineInputUpdate({
                schema: z.boolean(),
                update: () => false,
              })
            }
          })
        ])
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
  ], { concurrent: false })

  return tasks;
}
