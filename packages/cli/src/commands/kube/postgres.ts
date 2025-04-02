import postgresTerragruntHcl from "../../templates/kube_cloudnative_pg_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { tfInit } from "../../util/scripts/tf-init";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export async function setupCloudNativePG({
  context,
  verbose = false,
}: {
  context: BaseContext;
  verbose?: boolean;
}) {
  context.stdout.write("13.a. Setting up CloudNativePG (Postgres)\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_cloudnative_pg/terragrunt.hcl",
    sourceFile: await Bun.file(postgresTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_cloudnative_pg",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_cloudnative_pg",
  });
}
