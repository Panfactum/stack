import { getEnvironments } from "@/util/config/getEnvironments";
import { ENVIRONMENT_NAME_SCHEMA } from "./common";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for getEnvironment function inputs
 */
interface IGetEnvironmentInputs {
    /** Panfactum context for logging and configuration */
    context: PanfactumContext;
}

/**
 * Interface for getEnvironment function output
 */
interface IGetEnvironmentOutput {
    /** Name of the environment to create */
    name: string;
    /** Whether the environment was partially deployed already */
    partiallyDeployed: boolean;
}

export async function getEnvironment(inputs: IGetEnvironmentInputs): Promise<IGetEnvironmentOutput> {
    const { context } = inputs;

    const environments = await getEnvironments(context)
    const deployedEnvironments = environments.filter(env => env.deployed)
    const partiallyDeployedEnv = environments.find(env => !env.deployed)?.name
    const hasProd = environments.some(env => env.name.includes("prod"))
    const hasDev = environments.some(env => env.name.includes("dev"))

    const name = await context.logger.input({
        explainer: `
        What is the name of the environment you want to create?
        `,
        message: "Environment Name:",
        required: true,
        default: partiallyDeployedEnv ?? (!hasProd ? "production" : (!hasDev ? "development" : undefined)),
        validate: (value) => {
            const { error } = ENVIRONMENT_NAME_SCHEMA.safeParse(value)
            if (error) {
                return error.issues[0]?.message ?? "Invalid environment name"
            }

            if (deployedEnvironments.findIndex(({ name }) => name === value) !== -1) {
                return "An environment with that name already exists"
            }

            return true
        }
    });

    return {
        name,
        partiallyDeployed: environments.some(env => env.name === name)
    }
}