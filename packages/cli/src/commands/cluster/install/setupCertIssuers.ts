import path, { join } from "node:path";
import { z } from "zod";
import kubeCertIssuersTerragruntHcl from "@/templates/kube_cert_issuers_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
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

export async function setupCertificateIssuers(
  options: InstallClusterStepOptions,
  completed: boolean,
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

  const tasks = mainTask.newListr([])

  tasks.add({
    skip: () => completed,
    title: "Deploy Certificate Issuers",
    task: async (_, parentTask) => {
      interface Context {
        alertEmail?: string;
        route53Zones?: string[];
        productionEnvironment?: boolean;
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
          title: "Get Certificate Issuers Configuration",
          task: async (ctx, task) => {
            const originalInputs = await readYAMLFile({
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
                "Already have Certificate Issuers configuration, skipping..."
              );
              return;
            }

            // TODO: @seth - Just make this the account contact email
            // let's us remove another user input
            ctx.alertEmail = await context.logger.input({
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
              modulePath: join(clusterPath, MODULES.KUBE_CERT_ISSUERS),
            });
            ctx.vaultProxyPid = pid;
            ctx.vaultProxyPort = port;
          },
        },
        {
          task: async (ctx, task) => {
            return task.newListr<Context>(
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
                // TODO: rollout reset of cert manager every 90 seconds until the above task is completed
                // check for the certificate to be provisioned
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
                  module: MODULES.KUBE_CERT_MANAGER,
                  initModule: true,
                  inputUpdates: {
                    self_generated_certs_enabled: defineInputUpdate({
                      schema: z.boolean(),
                      update: () => false,
                    }),
                  },
                }),
              ],
              { ctx }
            );
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

  return tasks;
}
