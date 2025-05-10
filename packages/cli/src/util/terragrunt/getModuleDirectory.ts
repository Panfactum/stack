import { join } from "node:path"
import type { PanfactumContext } from "@/util/context/context";

export function getModuleDirectory({
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
    return join(context.repoVariables.environments_dir, environment, region, module)
}