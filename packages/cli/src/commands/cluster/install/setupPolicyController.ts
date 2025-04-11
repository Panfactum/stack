import { deployModule } from "./deployModule";
import kyvernoTerragruntHcl from "../../../../templates/kube_kyverno_terragrunt.hcl" with { type: "file" };
import kubePoliciesTerragruntHcl from "../../../../templates/kube_policies_terragrunt.hcl" with { type: "file" };
import type { InstallClusterStepOptions } from "./common";


export async function setupPolicyController(options: InstallClusterStepOptions) {
    const { stepNum } = options;

    /***************************************************
     * Deploy the Kyverno Module
     ***************************************************/
    await deployModule({
        ...options,
        stepId: "kyvernoIaCSetup",
        stepName: "Kyverno Setup",
        moduleDirectory: "kube_kyverno",
        terraguntContents: kyvernoTerragruntHcl,
        stepNum,
        subStepNum: 1,
    })


    /***************************************************
     * Deploy the Panfactum Policies
     ***************************************************/
    await deployModule({
        ...options,
        stepId: "panfactumPoliciesIaCSetup",
        stepName: "Panfactum Policies Setup",
        moduleDirectory: "kube_policies",
        terraguntContents: kubePoliciesTerragruntHcl,
        stepNum,
        subStepNum: 2,
    })

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
}