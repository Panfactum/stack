import kubeCiliumTerragruntHcl from "../../templates/kube_cilium_terragrunt.hcl" with { type: "file" };
import kubeCoreDnsTerragruntHcl from "../../templates/kube_core_dns_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { tfInit } from "../../util/scripts/tf-init";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export async function setupInternalClusterNetworking({
  context,
  verbose,
}: {
  context: BaseContext;
  verbose?: boolean;
}) {
  // https://panfactum.com/docs/edge/guides/bootstrapping/internal-cluster-networking#deploy-cilium
  context.stdout.write("4.a. Setting up Cilium\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_cilium/terragrunt.hcl",
    sourceFile: await Bun.file(kubeCiliumTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_cilium",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_cilium",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/internal-cluster-networking#deploy-coredns
  context.stdout.write("4.b. Setting up CoreDNS\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_core_dns/terragrunt.hcl",
    sourceFile: await Bun.file(kubeCoreDnsTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_core_dns",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_core_dns",
  });
}
