import postgresTerragruntHcl from "@/templates/kube_cloudnative_pg_terragrunt.hcl" with { type: "file" };
import { deployModule } from "./deployModule";
import type { InstallClusterStepOptions } from "./common";

export async function setupCloudNativePG(options: InstallClusterStepOptions) {
  /***************************************************
   * Deploy the Cloud Native PostgreSQL Module
   ***************************************************/
  await deployModule({
    ...options,
    moduleDirectory: "kube_cloudnative_pg",
    terraguntContents: await Bun.file(postgresTerragruntHcl).text(),
    stepName: "Cloud Native PostgreSQL Deployment",
    stepId: "deployCloudNativePG",
  });
}
