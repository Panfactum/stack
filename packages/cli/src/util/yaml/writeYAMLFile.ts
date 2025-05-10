import { stringify } from "yaml";
import { writeFile } from "../fs/writeFile";
import type { PanfactumContext } from "@/util/context/context";

export async function writeYAMLFile(inputs: { context: PanfactumContext, values: unknown, overwrite?: boolean, filePath: string }) {
    const { context, values, overwrite, filePath } = inputs;

    await writeFile({
        context,
        filePath,
        contents: stringify(values, { doubleQuotedAsJSON: true }),
        overwrite
    })
}