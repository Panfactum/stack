import { join } from "path";
import { z } from "zod";
import { readYAMLFile } from "./readYAMLFile";
import { writeYAMLFile } from "./writeYAMLFile";
import { fileExists } from "../fs/fileExists";
import type { PanfactumContext } from "@/util/context/context";

type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONValue[]
    | { [key: string]: JSONValue };

// todo: wtf is this?
export async function upsertPFYAMLFile(inputs: {
    context: PanfactumContext;
    environment: string;
    region: string;
    module: string;
    updates: Record<string, JSONValue>;
    realModuleName?: string;
}) {
    const { context, environment, region, module, realModuleName, updates } =
        inputs;

    const moduleDir = join(
        context.repoVariables.environments_dir,
        environment,
        region,
        module
    );

    const pfYAMLPath = join(moduleDir, ".pf.yaml");
    if (await fileExists(pfYAMLPath)) {
        const originalPf = await readYAMLFile({
            filePath: pfYAMLPath,
            context,
            validationSchema: z
                .object({}).passthrough(),
        });
        const newModuleConfig = {
            module: realModuleName,
            ...originalPf,
            ...updates,
        };
        await writeYAMLFile({
            context,
            filePath: pfYAMLPath,
            values: newModuleConfig,
            overwrite: true,
        });
    } else {
        await writeYAMLFile({
            context,
            filePath: pfYAMLPath,
            values: {
                ...updates,
            },
            overwrite: true,
        });
    }
}
