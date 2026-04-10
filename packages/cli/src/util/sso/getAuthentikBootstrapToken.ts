import { z } from "zod";
import { CLIError } from "@/util/error/error";
import { MODULES } from "@/util/terragrunt/constants";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for retrieving the Authentik bootstrap token
 */
interface IGetAuthentikBootstrapTokenInput {
    /** Panfactum context for logging and configuration */
    context: PanfactumContext;
    /** Environment name where kube_authentik is deployed */
    environment: string;
    /** Region name where kube_authentik is deployed */
    region: string;
    /** Environment variables to pass to the Terragrunt subprocess */
    env: Record<string, string | undefined>;
}

/**
 * Retrieves the Authentik bootstrap token from the kube_authentik Terragrunt module outputs
 *
 * @remarks
 * The bootstrap token is a short-lived credential generated during Authentik deployment.
 * It is read directly from Terragrunt state on each call rather than persisted to disk,
 * since it is a sensitive ephemeral value.
 *
 * @param input - Parameters for retrieving the bootstrap token
 * @returns The plaintext bootstrap token string
 *
 * @throws {@link CLIError}
 * Throws when the Terragrunt output call fails
 *
 * @throws {@link CLIError}
 * Throws when `akadmin_bootstrap_token` is absent from the module outputs
 */
export async function getAuthentikBootstrapToken(input: IGetAuthentikBootstrapTokenInput): Promise<string> {
    const { context, environment, region, env } = input;

    const outputs = await terragruntOutput({
        context,
        environment,
        region,
        env,
        module: MODULES.KUBE_AUTHENTIK,
        validationSchema: z.record(
            z.string(),
            z.object({
                sensitive: z.boolean(),
                type: z.string(),
                value: z.string(),
            })
        ),
    }).catch((error: unknown) => {
        throw new CLIError("Failed to retrieve kube_authentik Terragrunt outputs", error);
    });

    const token = outputs["akadmin_bootstrap_token"]?.value;

    if (!token) {
        throw new CLIError("akadmin_bootstrap_token not found in Authentik module outputs");
    }

    return token;
}
