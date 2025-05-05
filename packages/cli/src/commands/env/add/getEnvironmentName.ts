import { getEnvironments } from "@/util/config/getEnvironments";
import { ENVIRONMENT_NAME_SCHEMA } from "./common";
import type { PanfactumContext } from "@/util/context/context";

export async function getEnvironmentName(inputs: { context: PanfactumContext }) {
    const { context } = inputs;

    const environments = await getEnvironments(context)

    return context.logger.input({
        explainer: `
        What is the name of the environment you want to create?
        `,
        message: "Environment Name:",
        required: true,
        validate: (value) => {
            const { error } = ENVIRONMENT_NAME_SCHEMA.safeParse(value)
            if (error) {
                return error.issues[0]?.message ?? "Invalid environment name"
            }

            if (environments.findIndex(({ name }) => name === value) !== -1) {
                return "An environment with that name already exists"
            }

            return true
        }
    });
}