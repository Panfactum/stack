import { join } from "node:path"
import { z } from "zod";
import { readYAMLFile } from "./readYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getLocalModuleStatus({
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
    return readYAMLFile({
        context,
        filePath: join(moduleDir, ".pf.yaml"),
        throwOnEmpty: false,
        validationSchema: z.object({ status: z.enum(["applied", "error"]) }),
    });
}