import { join } from "node:path"
import { z } from "zod";
import { MODULE_STATUS_FILE } from "./constants";
import { MODULE_STATUS_FILE_SCHEMA, type DEPLOY_STATUS_SCHEMA, type INIT_STATUS_SCHEMA } from "./schemas";
import { directoryExists } from "../fs/directoryExist";
import { readYAMLFile } from "../yaml/readYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

type ModuleStatus = {
    environmentExists: boolean;
    regionExists: boolean;
    moduleExists: boolean;
    initStatus: z.infer<typeof INIT_STATUS_SCHEMA>
    deployStatus: z.infer<typeof DEPLOY_STATUS_SCHEMA>
}

export async function getLocalModuleStatus(inputs: {
    environment: string;
    region: string;
    module: string;
    context: PanfactumContext;
}): Promise<ModuleStatus> {

    const { context, environment, region, module } = inputs;
    const envDir = join(context.repoVariables.environments_dir, environment)
    const regionDir = join(envDir, region)
    const moduleDir = join(regionDir, module)

    if (!await directoryExists(moduleDir)) {
        if (!await directoryExists(regionDir)) {
            return {
                environmentExists: await directoryExists(envDir),
                regionExists: false,
                moduleExists: false,
                initStatus: "uninited",
                deployStatus: "undeployed"
            }
        } else {
            return {
                environmentExists: true,
                regionExists: true,
                moduleExists: false,
                initStatus: "uninited",
                deployStatus: "undeployed"
            }
        }
    }

    const localStatus = await readYAMLFile({
        context,
        filePath: join(moduleDir, MODULE_STATUS_FILE),
        throwOnEmpty: false,
        validationSchema: MODULE_STATUS_FILE_SCHEMA,
    });

    if (localStatus) {
        return {
            environmentExists: true,
            regionExists: true,
            moduleExists: true,
            ...localStatus
        }
    } else {
        // If the local status doesn't exist,
        // then we assume that the module was deployed
        // successfully by another user since the
        // status files are not committed.
        return {
            environmentExists: true,
            regionExists: true,
            moduleExists: true,
            initStatus: "success",
            deployStatus: "success"
        }
    }
}