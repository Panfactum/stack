import { mkdir } from "fs/promises";
import yaml from "yaml";
import { z } from "zod";
import { getRepoVariables } from "./get-repo-variables";
import buildkitConfigExample from "../../files/buildkit/config.example.yaml" with { type: "file" };
import { safeFileExists } from "../safe-file-exists";
import { checkRepoSetup } from "./check-repo-setup";
import { getBuildkitStateHash } from "./get-buildkit-state-hash";
import { getBuildkitUserStateHash } from "./get-buildkit-user-state-hash";
import { getModuleOutputs } from "./helpers/terragrunt/get-module-outputs";
import type { BaseContext } from "clipanion";

export async function updateBuildkit({
  buildConfig,
  context,
}: {
  buildConfig?: boolean;
  context: BaseContext;
}) {
  const repoVariables = await getRepoVariables({ context });
  const buildkitDirPath = repoVariables.buildkit_dir;
  const environmentsDirPath = repoVariables.environments_dir;

  // ############################################################
  // Step 1: Copy the static files
  // ############################################################
  await mkdir(buildkitDirPath, { mode: 0o755, recursive: true });
  const configFileExample = Bun.file(buildkitConfigExample);
  await Bun.write(
    Bun.file(buildkitDirPath + "/config.example.yaml"),
    configFileExample,
    {
      mode: 0o644,
    }
  );

  // ############################################################
  // Step 2: Update the global configuration
  // ############################################################

  const configFilePath = buildkitDirPath + "/config.yaml";
  const authFilePath = buildkitDirPath + "/config.json";
  const buildkitFilePath = buildkitDirPath + "/buildkit.json";

  if (buildConfig) {
    if (await safeFileExists(configFilePath)) {
      const configFile = Bun.file(configFilePath);
      const configFileJson = yaml.parse(await configFile.text());
      const configFileSchema = z.object({
        module: z.string(),
        bastion: z.string(),
      });
      const configFileParsed = configFileSchema.parse(configFileJson);

      const module = configFileParsed.module;
      const bastion = configFileParsed.bastion;
      const modulePath = environmentsDirPath + "/" + module;

      context.stdout.write(
        `Extracting buildkit configuration from ${module}...\n`
      );
      const moduleOutput = getModuleOutputs({
        context,
        modulePath,
        validationSchema: z.object({
          ecr_registry: z.string(),
          eks_cluster_name: z.string(),
          cache_bucket_name: z.string(),
          cache_bucket_region: z.string(),
        }),
      });

      context.stdout.write(`Generating config file...\n`);

      const ecrRegistry = moduleOutput.ecr_registry;
      const clusterName = moduleOutput.eks_cluster_name;
      const cacheBucketName = moduleOutput.cache_bucket_name;
      const cacheBucketRegion = moduleOutput.cache_bucket_region;

      const buildkitFile = {
        registry: ecrRegistry,
        cluster: clusterName,
        cache_bucket: cacheBucketName,
        cache_bucket_region: cacheBucketRegion,
        bastion: bastion,
        credHelpers: {
          [ecrRegistry]: "panfactum",
          "public.ecr.aws": "panfactum",
        },
      };

      await Bun.write(
        Bun.file(buildkitFilePath),
        JSON.stringify(buildkitFile, null, 2)
      );
    } else {
      context.stdout.write(
        `Warning: No configuration file exists at ${configFilePath}. Skipping setup...\n`
      );
    }

    const buildkitStateHash = await getBuildkitStateHash({ context });
    await Bun.write(
      Bun.file(buildkitDirPath + "/state.lock"),
      buildkitStateHash
    );

    // ############################################################
    // Step 3: Update the user configuration
    // ############################################################

    if (await safeFileExists(buildkitFilePath)) {
      if (!(await safeFileExists(authFilePath))) {
        await Bun.write(Bun.file(authFilePath), "{}");
      }
      const buildkitFile = Bun.file(buildkitFilePath);
      const buildkitFileJson = await buildkitFile.json();
      const buildkitFileSchema = z.object({
        credHelpers: z.record(z.string(), z.string()),
      });
      const buildkitFileParsed = buildkitFileSchema.parse(buildkitFileJson);
      const credHelpers = buildkitFileParsed.credHelpers;
      const authFile = Bun.file(authFilePath);
      const authFileJson = await authFile.json();
      const updatedAuthFile = {
        ...authFileJson,
        ...credHelpers,
      };
      await Bun.write(
        Bun.file(authFilePath),
        JSON.stringify(updatedAuthFile, null, 2)
      );
    }

    const buildkitUserStateHash = await getBuildkitUserStateHash({ context });
    await Bun.write(
      Bun.file(buildkitDirPath + "/state.user.lock"),
      buildkitUserStateHash
    );

    context.stdout.write(
      `BuildKit config files in ${buildkitDirPath} were updated.\n`
    );

    if (process.env["PF_SKIP_CHECK_REPO_SETUP"] !== "1") {
      await checkRepoSetup({ context });
    }
  }
}
