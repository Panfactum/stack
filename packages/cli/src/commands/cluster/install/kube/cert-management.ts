import { readdir } from "fs/promises";
import { checkbox, select } from "@inquirer/prompts";
import pc from "picocolors";
import { z } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { terragruntInitAndApply } from "@/util/terragrunt/terragruntInitAndApply";
import kubeCertIssuersTerragruntHclNonProduction from "../../../../templates/kube_cert_issuers_non_production_terragrunt.hcl" with { type: "file" };
import kubeCertIssuersTerragruntHclProduction from "../../../../templates/kube_cert_issuers_production_terragrunt.hcl" with { type: "file" };
import { checkStepCompletion } from "../../../../util/check-step-completion";
import { writeFile } from "../../../../util/fs/writeFile";
import { progressMessage } from "../../../../util/progress-message";
import { replaceHclValue } from "../../../../util/replace-hcl-value";
import { startBackgroundProcess } from "../../../../util/subprocess/backgroundProcess";
import { terragruntApply } from "../../../../util/terragrunt/terragruntApply";
import { updateConfigFile } from "../../../../util/update-config-file";
import { writeErrorToDebugFile } from "../../../../util/write-error-to-debug-file";
import type { PanfactumContext } from "@/context/context";

export const setupCertManagement = async ({
  context,
  configPath,
  alertEmail,
  verbose = false,
}: {
  context: PanfactumContext;
  configPath: string;
  alertEmail: string;
  verbose?: boolean;
}) => {
  // Until the devShell fully reloads this must be explicitly set in the spawned processes
  const env = {
    ...process.env,
    VAULT_ADDR: "http://127.0.0.1:8200",
    VAULT_TOKEN: process.env["VAULT_TOKEN"],
  };

  const pid = startBackgroundProcess({
    args: [
      "-n",
      "vault",
      "port-forward",
      "--address",
      "0.0.0.0",
      "svc/vault-active",
      "8200:8200",
    ],
    command: "kubectl",
    context,
    env,
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/certificate-management#deploy-issuers
  let certIssuersSetupComplete = false;
  try {
    certIssuersSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "certIssuersSetup",
      stepCompleteMessage:
        "8.b. Skipping certificate issuers as they're already complete.\n",
      stepNotCompleteMessage: "8.b. Setting up certificate issuers\n",
    });
  } catch {
    throw new Error("Failed to check if certificate issuers setup is complete");
  }

  if (!certIssuersSetupComplete) {
    // Find the delegated zones folders and see if this environment matches one of them
    const { environment } = await getPanfactumConfig({ context });
    const environmentDir = context.repoVariables.environments_dir;

    if (!environment) {
      throw new Error("PLACEHOLDER");
    }

    // Find all delegated zones folders
    const delegatedZonesFolders: { path: string; folderName: string }[] = [];

    try {
      // Get all environment directories
      const entries = await readdir(environmentDir, { withFileTypes: true });
      if (verbose) {
        context.stdout.write(`entries: ${JSON.stringify(entries, null, 2)}\n`);
      }
      const envDirs = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      if (verbose) {
        context.stdout.write(`envDirs: ${JSON.stringify(envDirs, null, 2)}\n`);
      }

      // Check each environment directory
      for (const envName of envDirs) {
        const envPath = `${environmentDir}/${envName}`;
        if (verbose) {
          context.stdout.write(`envPath: ${envPath}\n`);
        }

        // Get all folders in this environment directory
        const envSubEntries = await readdir(envPath, { withFileTypes: true });
        if (verbose) {
          context.stdout.write(
            `envSubEntries: ${JSON.stringify(envSubEntries, null, 2)}\n`
          );
        }
        const subDirs = envSubEntries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
        if (verbose) {
          context.stdout.write(
            `subDirs: ${JSON.stringify(subDirs, null, 2)}\n`
          );
        }

        // Check each region directory
        for (const subDir of subDirs) {
          const regionDirPath = `${envPath}/${subDir}`;
          if (verbose) {
            context.stdout.write(`regionDirPath: ${regionDirPath}\n`);
          }

          // Get all folders in this region directory
          const regionSubEntries = await readdir(regionDirPath, {
            withFileTypes: true,
          });
          if (verbose) {
            context.stdout.write(
              `regionSubEntries: ${JSON.stringify(regionSubEntries, null, 2)}\n`
            );
          }

          // Get all folders in this region directory
          const zoneSubEntries = regionSubEntries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
          if (verbose) {
            context.stdout.write(
              `zoneSubEntries: ${JSON.stringify(zoneSubEntries, null, 2)}\n`
            );
          }

          // Look for aws_delegated_zones_ prefixed folders
          for (const zone of zoneSubEntries) {
            if (zone.startsWith("aws_delegated_zones_")) {
              if (verbose) {
                context.stdout.write(`zone: ${zone}\n`);
              }
              delegatedZonesFolders.push({
                path: `${envPath}/${subDir}/${zone}`,
                folderName: `${zone}`,
              });
            }
          }
        }
      }
    } catch (error) {
      writeErrorToDebugFile({
        context,
        error,
      });
      const errorMessage =
        error instanceof Error
          ? `Error finding delegated zones folders: ${error.message}`
          : "Error finding delegated zones folders";
      context.stderr.write(`${pc.red(errorMessage)}\n`);
      throw new Error("Failed to find delegated zones folders");
    }

    if (verbose) {
      context.stdout.write(
        `delegatedZonesFolders: ${JSON.stringify(delegatedZonesFolders, null, 2)}\n`
      );
    }

    const delegatedZoneForCurrentEnvironment = delegatedZonesFolders.find(
      (folder) => folder.folderName === `aws_delegated_zones_${environment}`
    );

    if (verbose) {
      context.stdout.write(
        `delegatedZoneForCurrentEnvironment: ${JSON.stringify(
          delegatedZoneForCurrentEnvironment,
          null,
          2
        )}\n`
      );
    }

    let userSelectedDelegatedZone: string = "";
    if (!delegatedZoneForCurrentEnvironment) {
      userSelectedDelegatedZone = await select({
        message: pc.magenta(
          "Select the delegated zone for the current environment"
        ),
        choices: delegatedZonesFolders.map((folder) => ({
          name: folder.folderName,
          value: folder.path,
        })),
      });
    }

    let isProductionEnvironment = false;
    if (delegatedZoneForCurrentEnvironment) {
      isProductionEnvironment = delegatedZoneForCurrentEnvironment.path
        .split("/")
        .slice(0, -1)
        .join("/")
        .includes(environment);
    } else if (userSelectedDelegatedZone) {
      isProductionEnvironment = userSelectedDelegatedZone
        .split("/")
        .slice(0, -1)
        .join("/")
        .includes(environment);
    }

    if (verbose) {
      context.stdout.write(
        `isProductionEnvironment: ${isProductionEnvironment}\n`
      );
    }

    const zoneOutputProcess = Bun.spawnSync(["terragrunt", "output", "-json"], {
      cwd:
        delegatedZoneForCurrentEnvironment?.path || userSelectedDelegatedZone,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (verbose) {
      context.stdout.write(
        `zoneOutputProcess: ${JSON.stringify(zoneOutputProcess, null, 2)}\n`
      );
    }

    const zoneOutput = JSON.parse(zoneOutputProcess.stdout.toString());
    const zoneOutputSchema = z.object({
      zones: z.object({
        sensitive: z.boolean(),
        value: z.record(
          z.string(),
          z.object({
            zone_id: z.string(),
          })
        ),
      }),
      record_manager_role_arn: z.object({
        sensitive: z.boolean(),
        type: z.string(),
        value: z.string(),
      }),
    });
    const validatedZoneOutput = zoneOutputSchema.parse(zoneOutput);

    const userSelectedZones = await checkbox({
      message: pc.magenta(
        "Select the zones you want to include with this cluster:"
      ),
      choices: Object.keys(validatedZoneOutput.zones.value).map((zone) => zone),
      required: true,
    });

    const kubeCertIssuersTerragruntHclPath =
      "./kube_cert_issuers/terragrunt.hcl";
    const templateFile = isProductionEnvironment
      ? kubeCertIssuersTerragruntHclProduction
      : kubeCertIssuersTerragruntHclNonProduction;
    await writeFile({
      context,
      path: kubeCertIssuersTerragruntHclPath,
      contents: await Bun.file(templateFile).text(),
    });

    const templateHcl = await Bun.file(kubeCertIssuersTerragruntHclPath).text();
    let updatedTemplateHcl = "";
    if (isProductionEnvironment) {
      // take in the template HCL and iterate through the zones writing the dependency blocks
      // Read existing content
      const templateHclLines = templateHcl.split("\n");
      const updatedLines: string[] = [];
      let startWriting = false;

      for (const line of templateHclLines) {
        if (startWriting) {
          // write the new lines in a loop here
          // set startWriting back to false to conitue
          const zonesNames = Object.keys(validatedZoneOutput.zones.value);
          for (const zoneName of zonesNames) {
            if (!userSelectedZones.includes(zoneName)) {
              continue;
            }
            // add the raw string as we will call hclfmt on the file later
            updatedLines.push(
              `"${zoneName}" = {\nzone_id = dependency.delegated_zones.outputs.zones["${zoneName}"].zone_id\nrecord_manager_role_arn=dependency.delegated_zones.outputs.record_manager_role_arn\n}`
            );
          }
          startWriting = false;
        }

        updatedLines.push(line);

        // We want to insert the zones after the start of this block
        if (line.includes("route53_zones")) {
          startWriting = true;
        }
      }
      updatedTemplateHcl = updatedLines.join("\n");
    } else {
      // take in the template HCL and iterate through the zones writing the explicit zone id and record manager role arn values
      // take in the template HCL and iterate through the zones writing the dependency blocks
      // Read existing content
      const templateHclLines = templateHcl.split("\n");
      const updatedLines: string[] = [];
      let startWriting = false;

      for (const line of templateHclLines) {
        if (startWriting) {
          // write the new lines in a loop here
          // set startWriting back to false to conitue
          const recordManagerRoleArn =
            validatedZoneOutput.record_manager_role_arn.value;
          const zonesNames = Object.keys(validatedZoneOutput.zones.value);
          for (const zoneName of zonesNames) {
            if (!userSelectedZones.includes(zoneName)) {
              continue;
            }
            const zoneId = validatedZoneOutput.zones.value[zoneName]?.zone_id;
            // add the raw string as we will call hclfmt on the file later
            updatedLines.push(
              `"${zoneName}" = {\nzone_id = "${zoneId}"\nrecord_manager_role_arn = "${recordManagerRoleArn}"\n}`
            );
          }
          startWriting = false;
        }

        updatedLines.push(line);
        // We want to insert the zones after the start of this block
        if (line.includes("route53_zones")) {
          startWriting = true;
        }
      }
      updatedTemplateHcl = updatedLines.join("\n");
    }

    // Write the updated template HCL to the file
    await Bun.write(kubeCertIssuersTerragruntHclPath, updatedTemplateHcl);

    // Format the file
    Bun.spawnSync(["terragrunt", "hclfmt", kubeCertIssuersTerragruntHclPath]);

    await replaceHclValue(
      kubeCertIssuersTerragruntHclPath,
      "inputs.alert_email",
      alertEmail
    );

    await terragruntInitAndApply({
      context,
      modulePath: "./kube_cert_issuers",
    });

    await updateConfigFile({
      updates: {
        certIssuersSetup: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/certificate-management#deploy-the-first-certificate
  let firstCertificateDeployed = false;
  try {
    firstCertificateDeployed = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "firstCertificateDeployed",
      stepCompleteMessage:
        "8.c. Skipping first certificate deployment as it's already complete.\n",
      stepNotCompleteMessage: "8.c. Deploying the first certificate\n",
    });
  } catch {
    throw new Error("Failed to check if first certificate deployed");
  }

  if (!firstCertificateDeployed) {
    await replaceHclValue(
      "./kube_cert_manager/terragrunt.hcl",
      "inputs.self_generated_certs_enabled",
      false
    );

    try {
      let tfInitProgress: globalThis.Timer | undefined;
      if (!verbose) {
        tfInitProgress = progressMessage({
          context,
          message: `Deploying the first certificate`,
        });
      }

      try {
        terragruntApply({
          context,
          suppressErrors: true,
          workingDirectory: "./kube_cert_manager",
        });
      } catch {
        // It's okay if this fails as we must manually initialize the vault on first use
        // We'll ignore this and do more checks below to see if the vault was instantiated successfully
      }
      !verbose && globalThis.clearInterval(tfInitProgress);
      !verbose &&
        context.stdout.write(
          pc.green(`\rSuccessfully deployed the first certificate.          \n`)
        );
    } catch (error) {
      writeErrorToDebugFile({
        context,
        error,
      });
      throw new Error("Failed to deploy the first certificate");
    }
  }

  // To mitigate the long-running background process dying over time, we'll kill it here
  // and restart it when we need it.
  if (pid > 0) {
    try {
      process.kill(pid);
    } catch {
      // Do nothing as it's already dead
    }
  }
};
