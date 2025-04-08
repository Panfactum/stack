import { mkdir } from "fs/promises";
import yaml from "yaml";
import { z } from "zod";
import buildkitConfigExample from "../../files/buildkit/config.example.yaml" with { type: "file" };
import type { PanfactumContext } from "../../../context";
import { safeFileExists } from "../../../util/safe-file-exists";
import { getModuleOutputs } from "../../../util/scripts/helpers/terragrunt/get-module-outputs";

export async function buildBuildkitConfig({
  context,
}: {
  context: PanfactumContext;
}) {
  const { buildkit_dir, environments_dir } = context.repoVariables;

  // ############################################################
  // Step 1: Copy the static files
  // ############################################################
  await mkdir(buildkit_dir, { mode: 0o755, recursive: true });
  const configFileExample = Bun.file(buildkitConfigExample);
  await Bun.write(
    Bun.file(buildkit_dir + "/config.example.yaml"),
    configFileExample,
    {
      mode: 0o644,
    }
  );

  // ############################################################
  // Step 2: Update the global configuration
  // ############################################################

  const configFilePath = buildkit_dir + "/config.yaml";
  const buildkitFilePath = buildkit_dir + "/buildkit.json";

  if (await safeFileExists(configFilePath)) {

    // Parse the config file
    const configFile = Bun.file(configFilePath);
    const configFileJson = yaml.parse(await configFile.text());
    const configFileSchema = z.object({
      module: z.string(),
      bastion: z.string(),
    });
    const configFileParsed = configFileSchema.parse(configFileJson);

    const module = configFileParsed.module;
    const bastion = configFileParsed.bastion;
    const modulePath = environments_dir + "/" + module;

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
}
