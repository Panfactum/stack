import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";
import type { Listr } from "listr2";

export async function runTasks(inputs: {
    context: PanfactumContext,
    tasks: Listr,
    errorMessage: string;
}) {

    const { context, tasks, errorMessage } = inputs;
    try {
        await tasks.run()
        context.logger.write("") // Need a newline after tasks for spacing
    } catch (e) {
        throw new CLIError(errorMessage, e)
    }
}