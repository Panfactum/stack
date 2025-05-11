import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import type { PanfactumContext } from "@/util/context/context";

export async function isEnvironmentSuccessfullyConfigured(inputs: { context: PanfactumContext, environment: string }) {
    const { context, environment } = inputs;

    const status = await getModuleStatus({
        context,
        region: GLOBAL_REGION,
        environment: environment,
        module: environment === MANAGEMENT_ENVIRONMENT ? MODULES.AWS_ORGANIZATION : MODULES.AWS_ACCOUNT
    })
    return status.deploy_status === "success"
}