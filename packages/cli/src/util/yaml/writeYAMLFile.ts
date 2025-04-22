import {stringify} from "yaml";
import { writeFile } from "../fs/writeFile";
import type { PanfactumContext } from "@/context/context";

export async function writeYAMLFile(inputs: {context: PanfactumContext, contents: unknown, overwrite?: boolean, path: string}){
    const {context, contents, overwrite, path} = inputs;

    await writeFile({
        context,
        path,
        contents: stringify(contents, { doubleQuotedAsJSON: true }),
        overwrite
    })
}