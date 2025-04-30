import kyvernoTerragruntHcl from "@/templates/kube_kyverno_terragrunt.hcl" with { type: "file" };
import kubePoliciesTerragruntHcl from "@/templates/kube_policies_terragrunt.hcl" with { type: "file" };
import { getIdentity } from "@/util/aws/getIdentity";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask } from "@/util/terragrunt/tasks/deployModuleTask";
import type { InstallClusterStepOptions } from "./common";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function setupPolicyController(
  options: InstallClusterStepOptions,
  mainTask: PanfactumTaskWrapper
) {
  const { awsProfile, context, environment, region } = options;

  const tasks = mainTask.newListr([
    {
      title: "Verify access",
      task: async () => {
        await getIdentity({ context, profile: awsProfile });
      },
    },
    await buildDeployModuleTask({
      context,
      environment,
      region,
      taskTitle: "Deploy controller",
      module: MODULES.KUBE_KYVERNO,
      initModule: true,
      hclIfMissing: await Bun.file(kyvernoTerragruntHcl).text(),
    }),
    await buildDeployModuleTask({
      context,
      environment,
      region,
      taskTitle: "Deploy default policies",
      module: MODULES.KUBE_POLICIES,
      initModule: true,
      hclIfMissing: await Bun.file(kubePoliciesTerragruntHcl).text(),
    }),
    {
      title: "Network Test",
      task: async () => {
        /***************************************************
         * Network Test
         ***************************************************/
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
      },
      enabled: () => false,
    },
  ]);

  return tasks;
}
