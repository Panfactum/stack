import postgresTerragruntHcl from "../../../../templates/kube_cloudnative_pg_terragrunt.hcl" with { type: "file" };
import { writeFile } from "../../../../util/fs/writeFile";
import { initAndApplyModule } from "../../../../util/init-and-apply-module";
import type { PanfactumContext } from "@/context/context";

export async function setupCloudNativePG({
  context,
}: {
  context: PanfactumContext;
}) {
  context.logger.log("13.a. Setting up CloudNativePG (Postgres)");

  await writeFile({
    context,
    path: "./kube_cloudnative_pg/terragrunt.hcl",
    contents: await Bun.file(postgresTerragruntHcl).text(),
  });

  await initAndApplyModule({
    context,
    moduleName: "CloudNativePG",
    modulePath: "./kube_cloudnative_pg"
  });
}
