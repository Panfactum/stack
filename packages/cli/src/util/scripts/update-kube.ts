import { mkdir } from "fs/promises";
import yaml from "yaml";
import { z } from "zod";
import { getRepoVariables } from "./get-repo-variables";
import { getModuleOutputs } from "./helpers/terragrunt/get-module-outputs";
import kubeConfigExample from "../../files/kube/config.example.yaml" with { type: "file" };
import kubeUserConfigExample from "../../files/kube/config.user.example.yaml" with { type: "file" };
import { safeFileExists } from "../safe-file-exists";
import { getKubeUserStateHash } from "./get-kube-user-state-hash";
import type { BaseContext } from "clipanion";

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function updateKube({
  buildConfig,
  context,
}: {
  buildConfig: boolean;
  context: BaseContext;
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
      context.stderr.write("Building cluster_info file...\n");
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
        context.stdout.write(`Adding cluster at ${modulePath}... `);
        if (!(await Bun.file(modulePath).exists())) {
          context.stderr.write(`Error: No module at ${modulePath}!\n`);
          throw new Error(`No module at ${modulePath}!`);
        }
        const moduleOutput = await getModuleOutputs({
          context,
          modulePath,
          validationSchema: z.object({
            cluster_ca_data: z.string().base64(),
            cluster_url: z.string(),
            cluster_name: z.string(),
            cluster_region: z.string(),
          }),
        });
        const clusterCaData = globalThis.atob(moduleOutput.cluster_ca_data);
        const clusterUrl = moduleOutput.cluster_url;
        const clusterName = moduleOutput.cluster_name;
        const clusterRegion = moduleOutput.cluster_region;

        const clusterCaDataFile = `${kubeDir}/${clusterName}.crt`;
        await Bun.write(Bun.file(clusterCaDataFile), clusterCaData);

        const hasher = new Bun.CryptoHasher("md5");
        const clusterCaDataHash = hasher.update(clusterCaData).digest("hex");

        await Bun.write(
          Bun.file(clusterInfoFilePath),
          `${clusterName} ${clusterRegion} ${clusterUrl} ${clusterCaDataHash}`
        );

        context.stdout.write("Done!\n");
      }
    }
    context.stdout.write("cluster_info updated!\n");
    context.stdout.write("-----------------------------------\n");
  } else {
    context.stderr.write(
      `Error: No configuration file exists at ${configFilePath}. See https://panfactum.com/docs/reference/configuration/kubernetes.\n`
    );
    throw new Error(
      `No configuration file exists at ${configFilePath}. See https://panfactum.com/docs/reference/configuration/kubernetes.`
    );
  }

  // ############################################################
  // ## Step 3: Dynamically configure user-specific kubeconfig
  // ############################################################
  const userConfigFilePath = `${kubeDir}/config.user.yaml`;
  const userConfigFileExists = await safeFileExists(userConfigFilePath);

  if (userConfigFileExists && clusterInfoFileExists) {
    context.stdout.write(`Building kubeconfig file at ${kubeDir}/config...\n`);

    const userConfigFileJson = yaml.parse(userConfigFilePath);
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

      context.stdout.write(
        `Adding ${clusterName} using ${awsProfile} for authentication... `
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
          "pf get-kube-token",
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

      context.stdout.write("Done!\n");
    }

    context.stdout.write("All clusters configured!\n");
  } else {
    context.stderr.write(
      `Warning: No cluster_info file exists at ${clusterInfoFilePath}. A superuser must run 'pf update-kube --build' to generate this file. Skipping kubeconfig setup!\n`
    );
  }

  // Save the state hash
  const userStateHash = await getKubeUserStateHash({ context });
  await Bun.write(Bun.file(`${kubeDir}/state.user.lock`), userStateHash);

  context.stdout.write(
    "-----------------------------------------------------------\n"
  );
  context.stdout.write(`Kubernetes config files in ${kubeDir} were updated.\n`);

  if (process.env["PF_SKIP_CHECK_REPO_SETUP"] !== "1") {
    Bun.spawnSync(["pf-check-repo-setup"], {
      stdout: "inherit",
      stderr: "inherit",
    });
  }
}

const hasher = new Bun.CryptoHasher("md5");
export const updateKubeHash = hasher.update(String(updateKube)).digest("hex");
