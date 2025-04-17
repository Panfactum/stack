import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { input } from "@inquirer/prompts";
import pc from "picocolors";
import { z } from "zod";
import kubeCertIssuersTerragruntHclNonProduction from "@/templates/kube_cert_issuers_non_production_terragrunt.hcl" with { type: "file" };
import kubeCertIssuersTerragruntHclProduction from "@/templates/kube_cert_issuers_production_terragrunt.hcl" with { type: "file" };
import { CLIError } from "@/util/error/error";
import { writeFile } from "@/util/fs/writeFile";
import { killBackgroundProcess } from "@/util/subprocess/backgroundProcess";
import { execute } from "@/util/subprocess/execute";
import { startVaultProxy } from "@/util/subprocess/vaultProxy";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { deployModule } from "./deployModule";
import { informStepStart, informStepComplete } from "./messages";
import type { InstallClusterStepOptions } from "./common";

const ZONE_OUTPUT_SCHEMA = z.object({
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

export async function setupCertificateIssuers(
  options: InstallClusterStepOptions
) {
  const {
    awsProfile,
    checkpointer,
    clusterPath,
    context,
    environment,
    environmentPath,
    kubeDomain,
    stepNum,
  } = options;

  const modulePath = join(clusterPath, "kube_cert_issuers");
  const hclFile = join(modulePath, "terragrunt.hcl");

  const VAULT_TOKEN = await checkpointer.getSavedInput("vaultRootToken");
  const VAULT_ADDR = await checkpointer.getSavedInput("vaultAddress");
  const env = { ...process.env, VAULT_ADDR, VAULT_TOKEN };

  /***************************************************
   * Get the user-provided config for Certificate Issuers
   ***************************************************/
  const certificateAlertEmail = await checkpointer.getSavedInput(
    "certificateAlertEmail"
  );

  if (!certificateAlertEmail) {
    const certificateAlertEmail = await input({
      message: pc.magenta(
        "This email will receive notifications if your certificates fail to renew.\n" +
          "Enter an email that is actively monitored to prevent unexpected service disruptions.\n" +
          "->"
      ),
      required: true,
      validate: (value) => {
        // From https://emailregex.com/
        const emailRegex =
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (!emailRegex.test(value.trim())) {
          return "Please enter a valid email address";
        }
        return true;
      },
    });

    checkpointer.updateSavedInput(
      "certificateAlertEmail",
      certificateAlertEmail
    );
  }

  /***************************************************
   * Deploy the Certificate Issuers Module
   ***************************************************/
  const subStepLabel = "Certificate Issuers Deployment";
  const subStepNumber = 1;
  const certIssuersStepId = "certIssuersDeployment";
  if (await checkpointer.isStepComplete(certIssuersStepId)) {
    informStepComplete(context, subStepLabel, stepNum, subStepNumber);
  } else {
    informStepStart(context, subStepLabel, stepNum, subStepNumber);

    // TODO: @jack Make this finding the delegated zone records better
    // Find all delegated zones folders
    const delegatedZonesFolders: { path: string; folderName: string }[] = [];

    try {
      // Get all environment directories
      const entries = await readdir(environmentPath, { withFileTypes: true });

      context.logger.log(`entries: ${JSON.stringify(entries, null, 2)}`, {
        level: "debug",
      });

      const envDirs = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      context.logger.log(`envDirs: ${JSON.stringify(envDirs, null, 2)}`, {
        level: "debug",
      });
      // Check each environment directory
      for (const envName of envDirs) {
        const envPath = `${environmentPath}/${envName}`;
        context.logger.log(`envPath: ${envPath}`, {
          level: "debug",
        });

        // Get all folders in this environment directory
        const envSubEntries = await readdir(envPath, { withFileTypes: true });
        context.logger.log(
          `envSubEntries: ${JSON.stringify(envSubEntries, null, 2)}`,
          {
            level: "debug",
          }
        );
        const subDirs = envSubEntries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
        context.logger.log(`subDirs: ${JSON.stringify(subDirs, null, 2)}`, {
          level: "debug",
        });

        // Check each region directory
        for (const subDir of subDirs) {
          const regionDirPath = `${envPath}/${subDir}`;
          context.logger.log(`regionDirPath: ${regionDirPath}`, {
            level: "debug",
          });

          // Get all folders in this region directory
          const regionSubEntries = await readdir(regionDirPath, {
            withFileTypes: true,
          });
          context.logger.log(
            `regionSubEntries: ${JSON.stringify(regionSubEntries, null, 2)}`,
            {
              level: "debug",
            }
          );

          // Get all folders in this region directory
          const zoneSubEntries = regionSubEntries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
          context.logger.log(
            `zoneSubEntries: ${JSON.stringify(zoneSubEntries, null, 2)}`,
            {
              level: "debug",
            }
          );

          // Look for aws_delegated_zones_ prefixed folders
          for (const zone of zoneSubEntries) {
            if (zone.startsWith("aws_delegated_zones_")) {
              context.logger.log(`zone: ${zone}`, {
                level: "debug",
              });
              delegatedZonesFolders.push({
                path: join(envPath, subDir, zone),
                folderName: `${zone}`,
              });
            }
          }
        }
      }
    } catch (error) {
      throw new CLIError("Failed to find delegated zones folders");
    }

    context.logger.log(
      `delegatedZonesFolders: ${JSON.stringify(delegatedZonesFolders, null, 2)}`,
      {
        level: "debug",
      }
    );

    const delegatedZoneForCurrentEnvironment = delegatedZonesFolders.find(
      (folder) => folder.folderName === `aws_delegated_zones_${environment}`
    );

    if (!delegatedZoneForCurrentEnvironment) {
      throw new CLIError(
        `Delegated zone records for current environment not found: ${environment}`
      );
    }

    context.logger.log(
      `delegatedZoneForCurrentEnvironment: ${JSON.stringify(
        delegatedZoneForCurrentEnvironment,
        null,
        2
      )}`,
      { level: "debug" }
    );

    let isProductionEnvironment = false;

    isProductionEnvironment = delegatedZoneForCurrentEnvironment.path
      .split("/")
      .slice(0, -1)
      .join("/")
      .includes(environment);

    context.logger.log(`isProductionEnvironment: ${isProductionEnvironment}`, {
      level: "debug",
    });

    const delegatedZoneOutput = await terragruntOutput({
      awsProfile,
      context,
      modulePath: delegatedZoneForCurrentEnvironment.path,
      validationSchema: ZONE_OUTPUT_SCHEMA,
    });

    const delegatedZone = Object.keys(delegatedZoneOutput.zones.value).find(
      (zone) => {
        zone === kubeDomain;
      }
    );

    if (!delegatedZone) {
      throw new CLIError(
        `Delegated zone record for current region not found: ${kubeDomain}`
      );
    }

    const templateFile = isProductionEnvironment
      ? kubeCertIssuersTerragruntHclProduction
      : kubeCertIssuersTerragruntHclNonProduction;

    await writeFile({
      context,
      path: hclFile,
      contents: await Bun.file(templateFile).text(),
      overwrite: true,
    });

    const templateHcl = await Bun.file(hclFile).text();
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
          const zonesNames = Object.keys(delegatedZoneOutput.zones.value);
          for (const zoneName of zonesNames) {
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
            delegatedZoneOutput.record_manager_role_arn.value;
          const zonesNames = Object.keys(delegatedZoneOutput.zones.value);
          for (const zoneName of zonesNames) {
            const zoneId = delegatedZoneOutput.zones.value[zoneName]?.zone_id;
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
    await writeFile({
      context,
      path: hclFile,
      contents: updatedTemplateHcl,
      overwrite: true,
    });

    await execute({
      command: ["terragrunt", "hclfmt", hclFile],
      context,
      workingDirectory: modulePath,
    });

    const pid = await startVaultProxy({
      env,
      modulePath,
    });

    await deployModule({
      ...options,
      subStepNum: 1,
      stepId: "certIssuersIACDeployment",
      stepName: "Certificate Issuers Deployment",
      moduleDirectory: "kube_cert_issuers",
      terraguntContents: kubeCertIssuersTerragruntHclProduction,
      overwrite: false,
      hclUpdates: {
        "inputs.alert_email": certificateAlertEmail!,
      },
    });

    killBackgroundProcess({ pid, context });

    await checkpointer.setStepComplete(certIssuersStepId);
  }

  /***************************************************
   * Deploy the First Certificate
   ***************************************************/
  const pid = await startVaultProxy({
    env,
    modulePath,
  });

  await deployModule({
    ...options,
    subStepNum: 2,
    stepId: "firstCertificateDeployment",
    stepName: "First Certificate Deployment",
    moduleDirectory: "kube_cert_manager",
    terraguntContents: kubeCertIssuersTerragruntHclProduction,
    overwrite: false,
    hclUpdates: {
      "inputs.self_generated_certs_enabled": false,
    },
  });

  killBackgroundProcess({ pid, context });
}
