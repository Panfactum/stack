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

/**
 * Interface for upsertPFYAMLFile function inputs
 */
interface IUpsertPFYAMLFileInput {
    /** Panfactum context for operations */
    context: PanfactumContext;
    /** Environment name where the module resides */
    environment: string;
    /** Region name where the module resides */
    region: string;
    /** Module name to update */
    module: string;
    /** Key-value pairs to update in the .pf.yaml file */
    updates: Record<string, JSONValue>;
    /** Real module name if different from module parameter */
    realModuleName?: string;
}

// todo: wtf is this?
export async function upsertPFYAMLFile(input: IUpsertPFYAMLFileInput) {
    const { context, environment, region, module, realModuleName, updates } = input;

    const moduleDir = join(
        context.repoVariables.environments_dir,
        environment,
        region,
        module
    );

    const pfYAMLPath = join(moduleDir, ".pf.yaml");
    if (await fileExists({ filePath: pfYAMLPath })) {
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
