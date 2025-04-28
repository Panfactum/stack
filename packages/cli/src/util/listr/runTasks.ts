import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";
import type { Listr } from "listr2";

export async function runTasks<T>(inputs: {
    context: PanfactumContext,
    tasks: Listr<T>,
    errorMessage: string;
}) {

    const { context, tasks, errorMessage } = inputs;
    try {
        return tasks.run().then((res) => {
            context.logger.write("") // Need a newline after tasks for spacing
            return res
        })
    } catch (e) {
        throw new CLIError(errorMessage, e)
    }
}