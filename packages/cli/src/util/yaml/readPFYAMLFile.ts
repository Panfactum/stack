import { join } from "node:path"
import { z } from "zod";
import { readYAMLFile } from "./readYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

export async function readPFYAMLFile({
    environment,
    region,
    module,
    context
}: {
    environment: string;
    region: string;
    module: string;
    context: PanfactumContext;
}) {
    const moduleDir = join(context.repoVariables.environments_dir, environment, region, module)
    return readYAMLFile({ filePath: join(moduleDir, ".pf.yaml"), context, validationSchema: z.object({ status: z.enum(["applied", "error"]) }) });
}