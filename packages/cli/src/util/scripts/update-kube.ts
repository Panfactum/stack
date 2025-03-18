import { mkdir } from "fs/promises";
import { getRepoVariables } from "./get-repo-variables";
import kubeConfigExample from "../../files/kube/config.example.yaml" with { type: "file" };
import kubeUserConfigExample from "../../files/kube/config.user.example.yaml" with { type: "file" };
import type { BaseContext } from "clipanion";

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
  const configFile = Bun.file(kubeConfigExample);
  const userConfigFile = Bun.file(kubeUserConfigExample);
  await Bun.write(Bun.file(kubeDir + "/config.yaml"), configFile, {
    mode: 0o644,
  });
  await Bun.write(Bun.file(kubeDir + "/user-config.yaml"), userConfigFile, {
    mode: 0o644,
  });

  // ############################################################
  // ## Step 2: Build the cluster_info file
  // ############################################################
  const configFilePath = `${kubeDir}/config.yaml`;
  const clusterInfoFilePath = `${kubeDir}/cluster_info`;

  if (buildConfig) {
    const configFile = Bun.file(configFilePath);
    const clusterInfoFile = Bun.file(clusterInfoFilePath);
  }

  // ############################################################
  // ## Step 3: Dynamically configure user-specific kubeconfig
  // ############################################################
}
