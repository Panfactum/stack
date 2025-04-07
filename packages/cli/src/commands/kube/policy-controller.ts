import kyvernoTerragruntHcl from "../../templates/kube_kyverno_terragrunt.hcl" with { type: "file" };
import kubePoliciesTerragruntHcl from "../../templates/kube_policies_terragrunt.hcl" with { type: "file" };
import { checkStepCompletion } from "../../util/check-step-completion";
import { ensureFileExists } from "../../util/ensure-file-exists";
import { initAndApplyModule } from "../../util/init-and-apply-module";
import { updateConfigFile } from "../../util/update-config-file";
import type { BaseContext } from "clipanion";

export async function setupPolicyController({
  context,
  configPath,
  verbose,
}: {
  context: BaseContext;
  configPath: string;
  verbose?: boolean;
}) {
  // https://panfactum.com/docs/edge/guides/bootstrapping/policy-controller#deploy-kyverno
  let kyvernoIaCSetupComplete = false;
  try {
    kyvernoIaCSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "kyvernoIaCSetup",
      stepCompleteMessage:
        "5.a. Skipping Kyverno setup as it's already complete.\n",
      stepNotCompleteMessage: "5.a. Setting up Kyverno\n",
    });
  } catch {
    throw new Error("Failed to check if Kyverno setup is complete");
  }

  if (!kyvernoIaCSetupComplete) {
    await ensureFileExists({
      context,
      destinationFile: "./kube_kyverno/terragrunt.hcl",
      sourceFile: await Bun.file(kyvernoTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "Kyverno",
      modulePath: "./kube_kyverno",
      verbose,
    });

    await updateConfigFile({
      updates: {
        kyvernoIaCSetup: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/policy-controller#deploy-panfactum-policies
  let panfactumPoliciesIaCSetupComplete = false;
  try {
    panfactumPoliciesIaCSetupComplete = await checkStepCompletion({
      configFilePath: configPath,
      context,
      step: "panfactumPoliciesIaCSetup",
      stepCompleteMessage:
        "5.b. Skipping Panfactum policies setup as it's already complete.\n",
      stepNotCompleteMessage: "5.b. Setting up Panfactum policies\n",
    });
  } catch {
    throw new Error("Failed to check if Panfactum policies setup is complete");
  }

  if (!panfactumPoliciesIaCSetupComplete) {
    await ensureFileExists({
      context,
      destinationFile: "./kube_policies/terragrunt.hcl",
      sourceFile: await Bun.file(kubePoliciesTerragruntHcl).text(),
    });

    await initAndApplyModule({
      context,
      moduleName: "Panfactum Policies",
      modulePath: "./kube_policies",
      verbose,
    });

    await updateConfigFile({
      updates: {
        panfactumPoliciesIaCSetup: true,
      },
      configPath,
      context,
    });
  }

  // https://panfactum.com/docs/edge/guides/bootstrapping/policy-controller#run-network-tests
  // Not doing cilium tests at this time as there's an upstream issue with the tests. Will revisit when the issue is resolved.
  // context.stdout.write("5.c. Running network tests\n");
  // context.stdout.write(
  //   pc.red(
  //     pc.bold(
  //       "⏰ NOTE: The network tests may take up to 30 minutes to complete\n"
  //     )
  //   )
  // );
  // Bun.spawnSync(
  //   [
  //     "cilium",
  //     "connectivity",
  //     "test",
  //     "--test",
  //     "'!pod-to-pod-encryption'",
  //     "--test",
  //     "'!health'",
  //   ],
  //   {
  //     stdout: "inherit",
  //     stderr: "inherit",
  //   }
  // );

  // Cleanup, need to get all the namespaces as JSON, find the cilium tests one, and delete it.
}
