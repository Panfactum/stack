import { appendFileSync } from "fs";
import { mkdir } from "fs/promises";
import pc from "picocolors";
import yaml from "yaml";
import { z } from "zod";
import { checkRepoSetup } from "./check-repo-setup";
import { getKubeUserStateHash } from "./get-kube-user-state-hash";
import { getRepoVariables } from "./get-repo-variables";
import kubeConfigExample from "../../files/kube/config.example.yaml" with { type: "file" };
import kubeUserConfigExample from "../../files/kube/config.user.example.yaml" with { type: "file" };
import { safeDirectoryExists } from "../fs/directoryExist";
import { safeFileExists } from "../fs/safe-file-exists";
import { terragruntOutput } from "../terragrunt/terragruntOutput";
import type { BaseContext } from "clipanion";

/**
 * Updates Kubernetes configuration files and settings.
 *
 * This function performs several tasks:
 * 1. Copies static configuration example files to the Kubernetes directory
 * 2. Builds the cluster_info file with information about available Kubernetes clusters
 * 3. Dynamically configures user-specific kubeconfig based on user preferences
 *
 * @param {Object} options - Function options
 * @param {boolean} [options.buildConfig] - Whether to build the cluster_info file
 * @param {BaseContext} options.context - The CLI context for logging
 * @throws {Error} If required files are missing or configuration is invalid
 */
 
export async function updateKube({
  buildConfig,
  context,
  silent = false,
  verbose,
}: {
  buildConfig?: boolean;
  context: BaseContext;
  silent?: boolean;
  verbose?: boolean;
}) {
  // ############################################################
  // ## Step 1: Copy the static files
  // ############################################################
  const repoVariables = await getRepoVariables({ context });
  const kubeDir = repoVariables.kube_dir;
  const environmentsDir = repoVariables.environments_dir;

  await mkdir(kubeDir, { mode: 0o755, recursive: true });
  const configFileExample = Bun.file(kubeConfigExample);
  const configUserFileExample = Bun.file(kubeUserConfigExample);
  await Bun.write(
    Bun.file(kubeDir + "/config.example.yaml"),
    configFileExample,
    {
      mode: 0o644,
    }
  );
  await Bun.write(
    Bun.file(kubeDir + "/config.user.example.yaml"),
    configUserFileExample,
    {
      mode: 0o644,
    }
  );

  // ############################################################
  // ## Step 2: Build the cluster_info file
  // ############################################################
  const configFilePath = `${kubeDir}/config.yaml`;
  const configFileExists = await safeFileExists(configFilePath);
  const clusterInfoFilePath = `${kubeDir}/cluster_info`;
  const clusterInfoFileExists = await safeFileExists(clusterInfoFilePath);

  if (buildConfig) {
    if (configFileExists) {
      !silent && context.stdout.write("Building cluster_info file...\n");
      if (clusterInfoFileExists) {
        await Bun.file(clusterInfoFilePath).delete();
      }
      const configFile = Bun.file(configFilePath);
      const configFileText = await configFile.text();
      const configFileRawJson = yaml.parse(configFileText);
      const configFileSchema = z.object({
        clusters: z.array(
          z.object({
            module: z.string(),
          })
        ),
      });
      const configFileJson = configFileSchema.parse(configFileRawJson);
      const numberOfClusters = configFileJson.clusters.length;

      if (numberOfClusters === 0) {
        context.stderr.write(
          `Error: 'clusters' not specified in ${configFilePath}!\n`
        );
        throw new Error(`'clusters' not specified in ${configFilePath}!`);
      }

      for (let i = 0; i < numberOfClusters; i++) {
        const cluster = configFileJson.clusters[i];
        // This should never happen but we're going to be super strict with using TypeScript
        if (!cluster) {
          context.stderr.write(
            `Error: No cluster specified in ${configFilePath}!\n`
          );
          throw new Error(`No cluster specified in ${configFilePath}!`);
        }
        const modulePath = `${environmentsDir}/${cluster.module}`;
        !silent && context.stdout.write(`Adding cluster at ${modulePath}...\n`);
        if (!(await safeDirectoryExists(modulePath))) {
          context.stderr.write(`Error: No module at ${modulePath}!\n`);
          throw new Error(`No module at ${modulePath}!`);
        }
        const moduleOutput = terragruntOutput({
          context,
          modulePath,
          silent,
          validationSchema: z.object({
            cluster_ca_data: z.object({
              sensitive: z.boolean(),
              type: z.string(),
              value: z.string().base64(),
            }),
            cluster_url: z.object({ value: z.string() }),
            cluster_name: z.object({ value: z.string() }),
            cluster_region: z.object({ value: z.string() }),
          }),
          verbose,
        });
        const clusterCaData = globalThis.atob(
          moduleOutput.cluster_ca_data.value
        );
        const clusterUrl = moduleOutput.cluster_url.value;
        const clusterName = moduleOutput.cluster_name.value;
        const clusterRegion = moduleOutput.cluster_region.value;

        const clusterCaDataFile = `${kubeDir}/${clusterName}.crt`;
        await Bun.write(Bun.file(clusterCaDataFile), clusterCaData);

        const hasher = new Bun.CryptoHasher("md5");
        const clusterCaDataHash = hasher.update(clusterCaData).digest("hex");

        if (i === 0) {
          await Bun.write(
            Bun.file(clusterInfoFilePath),
            `${clusterName} ${clusterRegion} ${clusterUrl} ${clusterCaDataHash}`
          );
        } else {
          appendFileSync(
            clusterInfoFilePath,
            `\n${clusterName} ${clusterRegion} ${clusterUrl} ${clusterCaDataHash}`
          );
        }

        !silent &&
          context.stdout.write(pc.green("Cluster added successfully!\n"));
      }

      !silent && context.stdout.write("cluster_info updated!\n");
      !silent && context.stdout.write("-----------------------------------\n");
    } else {
      context.stderr.write(
        `Error: No configuration file exists at ${configFilePath}. See https://panfactum.com/docs/reference/configuration/kubernetes.\n`
      );
      throw new Error(
        `No configuration file exists at ${configFilePath}. See https://panfactum.com/docs/reference/configuration/kubernetes.`
      );
    }
  }

  // ############################################################
  // ## Step 3: Dynamically configure user-specific kubeconfig
  // ############################################################
  const userConfigFilePath = `${kubeDir}/config.user.yaml`;
  const userConfigFileExists = await safeFileExists(userConfigFilePath);

  if (userConfigFileExists && clusterInfoFileExists) {
    !silent &&
      context.stdout.write(
        `Building kubeconfig file at ${kubeDir}/config...\n`
      );

    const userConfigFileJson = yaml.parse(
      await Bun.file(userConfigFilePath).text()
    );
    const userConfigFileSchema = z.object({
      clusters: z.array(
        z.object({
          name: z.string(),
          aws_profile: z.string(),
        })
      ),
    });
    const userConfigFileValidated =
      userConfigFileSchema.parse(userConfigFileJson);
    const numberOfClusters = userConfigFileValidated.clusters.length;

    if (numberOfClusters === 0) {
      context.stderr.write(
        `Error: 'clusters' not specified in ${userConfigFilePath}!\n`
      );
      throw new Error(`'clusters' not specified in ${userConfigFilePath}!`);
    }

    for (let i = 0; i < numberOfClusters; i++) {
      const cluster = userConfigFileValidated.clusters[i];
      if (!cluster) {
        context.stderr.write(
          `Error: No cluster specified in ${userConfigFilePath}!\n`
        );
        throw new Error(`No cluster specified in ${userConfigFilePath}!`);
      }

      const clusterName = cluster.name;
      const awsProfile = cluster.aws_profile;

      !silent &&
        context.stdout.write(
          `Adding ${clusterName} using ${awsProfile} for authentication...\n`
        );

      // Validate the AWS profile
      const proc = Bun.spawnSync(["aws", "configure", "list-profiles"]);
      if (!proc.stdout.toString().includes(awsProfile)) {
        context.stderr.write(
          `Error: AWS profile ${awsProfile} does not exist. Ensure this name is correct or have a superuser run 'pf update-aws --build' to regenerate your AWS profiles.\n`
        );
        throw new Error(
          `AWS profile ${awsProfile} does not exist. Ensure this name is correct or have a superuser run 'pf update-aws --build' to regenerate your AWS profiles.`
        );
      }

      // Extract the cluster info
      const clusterInfoFile = await Bun.file(clusterInfoFilePath).text();
      const clusterInfoLines = clusterInfoFile.split("\n");
      const clusterInfo = clusterInfoLines.find((line) =>
        line.startsWith(`${clusterName} `)
      );
      if (!clusterInfo) {
        context.stderr.write(
          `Error: ${clusterName} not found in ${clusterInfoFilePath}. Ensure this name is correct or have a superuser run 'pf update-kube --build' to regenerate your AWS profiles.\n`
        );
        throw new Error(
          `${clusterName} not found in ${clusterInfoFilePath}. Ensure this name is correct or have a superuser run 'pf update-kube --build' to regenerate your AWS profiles.`
        );
      }

      const [, clusterInfoRegion, clusterInfoUrl] = clusterInfo.split(" ");

      if (!clusterInfoUrl || !clusterInfoRegion) {
        context.stderr.write(
          `Error: ${clusterName} not found in ${clusterInfoFilePath}. Ensure this name is correct or have a superuser run 'pf update-kube --build' to regenerate this file.\n`
        );
        throw new Error(
          `${clusterName} not found in ${clusterInfoFilePath}. Ensure this name is correct or have a superuser run 'pf update-kube --build' to regenerate this file.`
        );
      }

      const caDataFilePath = `${kubeDir}/${clusterName}.crt`;

      const caDataFileExists = await safeFileExists(caDataFilePath);
      if (!caDataFileExists) {
        context.stderr.write(
          `Error: No CA cert found at ${caDataFilePath}. Have a superuser run 'pf update-kube --build' to regenerate this file.\n`
        );
        throw new Error(
          `No CA cert found at ${caDataFilePath}. Have a superuser run 'pf update-kube --build' to regenerate this file.`
        );
      }

      Bun.spawnSync(
        [
          "kubectl",
          "config",
          "set-credentials",
          clusterName,
          "--exec-api-version",
          "client.authentication.k8s.io/v1beta1",
          "--exec-command",
          "pf-get-kube-token",
          "--exec-arg",
          `--region,${clusterInfoRegion},--cluster-name,${clusterName},--profile,${awsProfile}`,
        ],
        {
          stdout: "ignore",
          stderr: "ignore",
        }
      );

      Bun.spawnSync(
        [
          "kubectl",
          "config",
          "set-cluster",
          clusterName,
          "--server",
          clusterInfoUrl,
          "--certificate-authority",
          caDataFilePath,
          "--embed-certs",
        ],
        {
          stdout: "ignore",
          stderr: "ignore",
        }
      );

      Bun.spawnSync(
        [
          "kubectl",
          "config",
          "set-context",
          clusterName,
          "--user",
          clusterName,
          "--cluster",
          clusterName,
        ],
        {
          stdout: "ignore",
          stderr: "ignore",
        }
      );

      !silent && context.stdout.write("Done!\n");
    }

    !silent && context.stdout.write("All clusters configured!\n");
  } else {
    context.stderr.write(
      `Warning: No cluster_info file exists at ${clusterInfoFilePath}. A superuser must run 'pf update-kube --build' to generate this file. Skipping kubeconfig setup!\n`
    );
  }

  // Save the state hash
  const userStateHash = await getKubeUserStateHash({ context });
  await Bun.write(Bun.file(`${kubeDir}/state.user.lock`), userStateHash);

  !silent &&
    context.stdout.write(
      "-----------------------------------------------------------\n"
    );
  !silent &&
    context.stdout.write(
      `Kubernetes config files in ${kubeDir} were updated.\n`
    );

  if (process.env["PF_SKIP_CHECK_REPO_SETUP"] !== "1") {
    await checkRepoSetup({ context });
  }
}
