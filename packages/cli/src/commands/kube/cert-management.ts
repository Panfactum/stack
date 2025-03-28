import { readdir } from "fs/promises";
import { select } from "@inquirer/prompts";
import pc from "picocolors";
import { z } from "zod";
import kubeCertIssuersTerragruntHcl from "../../templates/kube_cert_issuers_terragrunt.hcl" with { type: "file" };
import kubeCertManagerTerragruntHcl from "../../templates/kube_cert_manager_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { replaceHclValue } from "../../util/replace-hcl-value";
import { getRepoVariables } from "../../util/scripts/get-repo-variables";
import { getTerragruntVariables } from "../../util/scripts/get-terragrunt-variables";
import { tfInit } from "../../util/scripts/tf-init";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export const setupCertManagement = async ({
  context,
  alertEmail,
  verbose = false,
}: {
  context: BaseContext;
  alertEmail: string;
  verbose?: boolean;
  // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
  // https://panfactum.com/docs/edge/guides/bootstrapping/certificate-management#deploy-cert-manger
  context.stdout.write(pc.blue("8.a. Setting up Kubernetes cert manager\n"));

  await ensureFileExists({
    context,
    destinationFile: "./kube_cert_manager/terragrunt.hcl",
    sourceFile: await Bun.file(kubeCertManagerTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_cert_manager",
  });

  apply({
    context,
    suppressErrors: true,
    verbose,
    workingDirectory: "./kube_cert_manager",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/certificate-management#deploy-issuers
  context.stdout.write(pc.green("8.b. Setting up certificate issuers\n"));

  const kubeCertIssuersTerragruntHclPath = "./kube_cert_issuers/terragrunt.hcl";
  await ensureFileExists({
    context,
    destinationFile: kubeCertIssuersTerragruntHclPath,
    sourceFile: await Bun.file(kubeCertIssuersTerragruntHcl).text(),
  });

  // Find the delegated zones folders and see if this environment matches one of them
  const repoVariables = await getRepoVariables({ context });
  const terragruntVariables = await getTerragruntVariables({ context });
  const environmentDir = repoVariables.environments_dir;
  const environment = terragruntVariables.environment;

  // Find all delegated zones folders
  const delegatedZonesFolders: { path: string; folderName: string }[] = [];

  try {
    // Get all environment directories
    const entries = await readdir(environmentDir, { withFileTypes: true });
    const envDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // Check each environment directory
    for (const envName of envDirs) {
      const envPath = `${environmentDir}/${envName}`;

      // Get all folders in this environment directory
      const envSubDirs = await readdir(envPath, { withFileTypes: true });
      const subDirs = envSubDirs
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      // Look for aws_delegated_zones_ prefixed folders
      for (const subDir of subDirs) {
        if (subDir.startsWith("aws_delegated_zones_")) {
          delegatedZonesFolders.push({
            path: `${envPath}/${subDir}`,
            folderName: subDir,
          });
        }
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Error finding delegated zones folders: ${error.message}`
        : "Error finding delegated zones folders";
    context.stderr.write(`${pc.red(errorMessage)}\n`);
    throw new Error("Failed to find delegated zones folders");
  }

  const delegatedZoneForCurrentEnvironment = delegatedZonesFolders.find(
    (folder) => folder.folderName === `aws_delegated_zones_${environment}`
  );

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

  const zoneOutputProcess = Bun.spawnSync(["terragrunt", "output", "-json"], {
    cwd: delegatedZoneForCurrentEnvironment?.path || userSelectedDelegatedZone,
    stdout: verbose ? "inherit" : "pipe",
    stderr: "pipe",
  });

  const zoneOutput = JSON.parse(zoneOutputProcess.stdout?.toString() || "{}");
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
          const zoneId = validatedZoneOutput.zones.value[zoneName]?.zone_id;
          // add the raw string as we will call hclfmt on the file later
          updatedLines.push(
            `"${zoneName}" = {\nzone_id = ${zoneId}\nrecord_manager_role_arn=${recordManagerRoleArn}\n}`
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

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_cert_issuers",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_cert_issuers",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/certificate-management#deploy-the-first-certificate
  context.stdout.write(pc.green("8.c. Deploying the first certificate\n"));

  await replaceHclValue(
    "./kube_cert_manager/terragrunt.hcl",
    "inputs.self_generated_certs_enabled",
    false
  );

  apply({
    context,
    verbose,
    workingDirectory: "./kube_cert_manager",
  });
};
