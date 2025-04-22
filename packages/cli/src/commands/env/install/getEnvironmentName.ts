import { input } from "@inquirer/prompts";
import pc from "picocolors";
import { applyColors } from "@/util/colors/applyColors";
import { getEnvironments } from "@/util/config/getEnvironments";
import { ENVIRONMENT_NAME_SCHEMA } from "./common";
import type { PanfactumContext } from "@/context/context";

export async function getEnvironmentName(inputs: { context: PanfactumContext }) {
    const { context } = inputs;

    const environments = await getEnvironments(context)

    context.logger.log(
        "🛈  Let's start the environment installation.\n\n" +
        "What is the name of the environment you want to create?",
        { trailingNewlines: 1 }
    )

    return input({
        message: pc.magenta("Environment Name:"),
        required: true,
        validate: (value) => {
            const { error } = ENVIRONMENT_NAME_SCHEMA.safeParse(value)
            if (error) {
                return applyColors(error.issues[0]?.message ?? "Invalid environment name", {style: "error"})
            }

            if (environments.findIndex(({ name }) => name === value) !== -1) {
                return applyColors("An environment with that name already exists", {style: "error"})
            }

            return true
        }
    });
}