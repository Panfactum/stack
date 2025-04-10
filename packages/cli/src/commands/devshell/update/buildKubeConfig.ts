import { mkdir } from "fs/promises";
import path from "path";
import { Glob } from "bun";
import { z } from "zod";
import { safeFileExists } from "../../../util/fs/safe-file-exists";
import { getLastPathSegments } from "../../../util/getLastPathSegments";
import { terragruntOutput } from "../../../util/terragrunt/terragruntOutput";
import { createNullWriter } from "../../../util/writers/createNullWriter";
import type { PanfactumContext } from "../../../context/context";


 
export async function buildKubeConfig({ context }: { context: PanfactumContext }) {
  const { kube_dir, environments_dir } = context.repoVariables;

  const clusterInfoFilePath = `${kube_dir}/cluster_info`;

  if (await safeFileExists(clusterInfoFilePath)) {
    await Bun.file(clusterInfoFilePath).delete();
  }

  const glob = new Glob(`${environments_dir}/**/aws_eks/terragrunt.hcl`);
  const awsClusterHCLs = Array.from(glob.scanSync(environments_dir));

  if(awsClusterHCLs.length > 0){
    context.logger.log(`Connecting DevShell to deployed clusters:\n`);
    await mkdir(kube_dir, { mode: 0o755, recursive: true });
    const clusterInfo: string[] = [];
    await Promise.all(Array.from(glob.scanSync(environments_dir)).map(async (clusterTerragruntHcl) => {
      const directory = path.dirname(clusterTerragruntHcl);
      context.logger.log(`Adding cluster at ${getLastPathSegments(directory,3)}...`, {
        indentLevel: 1
      });
      const moduleOutput = await terragruntOutput({
        context: {
          ...context,
          stdout: createNullWriter()
        },
        modulePath: directory,
        validationSchema: z.object({
          cluster_ca_data: z.object({
            sensitive: z.boolean(),
            type: z.string(),
            value: z.string().base64(),
          }),
          cluster_url: z.object({ value: z.string() }),
          cluster_name: z.object({ value: z.string() }),
          cluster_region: z.object({ value: z.string() }),
        })
      });
      const clusterCaData = globalThis.atob(
        moduleOutput.cluster_ca_data.value
      );
      const clusterUrl = moduleOutput.cluster_url.value;
      const clusterName = moduleOutput.cluster_name.value;
      const clusterRegion = moduleOutput.cluster_region.value;
  
      const clusterCaDataFile = `${kube_dir}/${clusterName}.crt`;
      await Bun.write(Bun.file(clusterCaDataFile), clusterCaData);
  
      const hasher = new Bun.CryptoHasher("md5");
      const clusterCaDataHash = hasher.update(clusterCaData).digest("hex");
      clusterInfo.push(`${clusterName} ${clusterRegion} ${clusterUrl} ${clusterCaDataHash}`)
    }))
  
    await Bun.write(
      Bun.file(clusterInfoFilePath),
      clusterInfo.join("\n")
    );

    context.logger.log(`Clusters connected!`, {
      style: "success",
      leadingNewlines: 1,
      trailingNewlines: 2,
      indentLevel: 1
    });
  }
}
