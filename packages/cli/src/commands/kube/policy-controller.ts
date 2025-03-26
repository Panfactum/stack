import pc from "picocolors";
import kyvernoTerragruntHcl from "../../templates/kube_kyverno_terragrunt.hcl" with { type: "file" };
import kubePoliciesTerragruntHcl from "../../templates/kube_policies_terragrunt.hcl" with { type: "file" };
import { ensureFileExists } from "../../util/ensure-file-exists";
import { tfInit } from "../../util/scripts/tf-init";
import { apply } from "../terragrunt/apply";
import type { BaseContext } from "clipanion";

export async function setupPolicyController({
  context,
  verbose,
}: {
  context: BaseContext;
  verbose?: boolean;
}) {
  // https://panfactum.com/docs/edge/guides/bootstrapping/policy-controller#deploy-kyverno
  context.stdout.write("5.a. Setting up Kyverno\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_kyverno/terragrunt.hcl",
    sourceFile: await Bun.file(kyvernoTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_kyverno",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_kyverno",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/policy-controller#deploy-panfactum-policies
  context.stdout.write("5.b. Setting up Panfactum policies\n");

  await ensureFileExists({
    context,
    destinationFile: "./kube_policies/terragrunt.hcl",
    sourceFile: await Bun.file(kubePoliciesTerragruntHcl).text(),
  });

  tfInit({
    context,
    verbose,
    workingDirectory: "./kube_policies",
  });

  apply({
    context,
    verbose,
    workingDirectory: "./kube_policies",
  });

  // https://panfactum.com/docs/edge/guides/bootstrapping/policy-controller#run-network-tests
  context.stdout.write("5.c. Running network tests\n");
  context.stdout.write(
    pc.red(
      pc.bold(
        "⏰ NOTE: The network tests may take up to 30 minutes to complete\n"
      )
    )
  );
  Bun.spawnSync(
    [
      "cilium",
      "connectivity",
      "test",
      "--test",
      "'!pod-to-pod-encryption'",
      "--test",
      "!health",
    ],
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );

  // Cleanup, need to get all the namespaces as JSON and find the cilium tests one.
}
