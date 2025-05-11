import { join } from "node:path"
import { z } from "zod";
import { MODULE_STATUS_FILE } from "./constants";
import { MODULE_STATUS_FILE_SCHEMA, type DEPLOY_STATUS_SCHEMA, type INIT_STATUS_SCHEMA } from "./schemas";
import { directoryExists } from "../fs/directoryExist";
import { readYAMLFile } from "../yaml/readYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

type ModuleStatus = {
    environment_exists: boolean;
    region_exists: boolean;
    module_exists: boolean;
    init_status: z.infer<typeof INIT_STATUS_SCHEMA>
    deploy_status: z.infer<typeof DEPLOY_STATUS_SCHEMA>
}

export async function getModuleStatus(inputs: {
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
                environment_exists: await directoryExists(envDir),
                region_exists: false,
                module_exists: false,
                init_status: "uninited",
                deploy_status: "undeployed"
            }
        } else {
            return {
                environment_exists: true,
                region_exists: true,
                module_exists: false,
                init_status: "uninited",
                deploy_status: "undeployed"
            }
        }
    }

    const moduleStatus = await readYAMLFile({
        context,
        filePath: join(moduleDir, MODULE_STATUS_FILE),
        throwOnEmpty: false,
        validationSchema: MODULE_STATUS_FILE_SCHEMA
    });

    if (moduleStatus) {
        return {
            environment_exists: true,
            region_exists: true,
            module_exists: true,
            ...moduleStatus
        }
    } else {
        return {
            environment_exists: true,
            region_exists: true,
            module_exists: true,
            init_status: "uninited",
            deploy_status: "undeployed"
        }
    }
}