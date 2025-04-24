import path, { join } from "node:path";
import { input } from "@inquirer/prompts";
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { Listr } from "listr2";
import pc from "picocolors";
import { z } from "zod";
import kubeCertIssuersTerragruntHclNonProduction from "@/templates/kube_cert_issuers_non_production_terragrunt.hcl" with { type: "file" };
import kubeCertIssuersTerragruntHclProduction from "@/templates/kube_cert_issuers_production_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { CLIError } from "@/util/error/error";
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

export async function setupCertificateIssuers(
  options: InstallClusterStepOptions,
  completed: boolean
) {
  const { awsProfile, clusterPath, context, environment, region } = options;

  const { root_token: vaultRootToken } = await sopsDecrypt({
    filePath: join(clusterPath, MODULES.KUBE_VAULT, "secrets.yaml"),
    context,
    validationSchema: z.object({
      root_token: z.string(),
    }),
  });

  const tasks = new Listr([]);

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

            ctx.alertEmail = await task
              .prompt(ListrInquirerPromptAdapter)
              .run(input, {
                message: pc.magenta(
                  "This email will receive notifications if your certificates fail to renew.\n" +
                    "Enter an email that is actively monitored to prevent unexpected service disruptions.\n" +
                    "->"
                ),
                required: true,
                validate: (value: string) => {
                  // From https://emailregex.com/
                  const emailRegex =
                    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                  if (!emailRegex.test(value.trim())) {
                    return "Please enter a valid email address";
                  }
                  return true;
                },
              });
          },
        },
        {
          title: "Get Route53 Delegated Zone Records",
          task: async () => {
            // TODO: @jack get the delegated zone records for the current environment
            // to pass to the Certificate Issuers Module. Also define if this is a production
            // or non-production environment as the template file is different.
          },
          enabled: () => false,
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
          task: async (ctx) => {
            await buildDeployModuleTask<Context>({
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
              hclIfMissing: ctx.productionEnvironment
                ? await Bun.file(kubeCertIssuersTerragruntHclProduction).text()
                : await Bun.file(
                    kubeCertIssuersTerragruntHclNonProduction
                  ).text(),
              inputUpdates: {
                alert_email: defineInputUpdate({
                  schema: z.string(),
                  update: (_, ctx) => ctx.alertEmail!,
                }),
                // route53_zones: defineInputUpdate({
                //   schema: z.array(z.string()),
                //   update: (_, ctx) => ctx.route53Zones!,
                // }),
              },
            });
          },
        },
        {
          task: async (ctx) => {
            await buildDeployModuleTask<Context>({
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
    throw new CLIError("Failed to deploy Certificate Issuers", e);
  }
}
