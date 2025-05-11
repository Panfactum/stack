import { join } from "node:path"
import { MODULE_STATUS_FILE } from "./constants";
import { MODULE_STATUS_FILE_SCHEMA, type DEPLOY_STATUS_SCHEMA, type INIT_STATUS_SCHEMA } from "./schemas"
import { CLIError } from "../error/error";
import { directoryExists } from "../fs/directoryExist";
import { fileExists } from "../fs/fileExists";
import { readYAMLFile } from "../yaml/readYAMLFile";
import { writeYAMLFile } from "../yaml/writeYAMLFile";
import type { PanfactumContext } from "../context/context";
import type { z } from "zod"

type Inputs = {
    moduleDirectory: string;
    context: PanfactumContext;
    initStatus?: z.infer<typeof INIT_STATUS_SCHEMA>,
    deployStatus?: z.infer<typeof DEPLOY_STATUS_SCHEMA>
}

export async function updateModuleStatus(inputs: Inputs) {
    const { initStatus, deployStatus, moduleDirectory, context } = inputs;

    if (! await directoryExists(moduleDirectory)) {
        throw new CLIError(`Cannot update the status of a module with non-existant directory ${moduleDirectory}`)
    } else if (! await fileExists(join(moduleDirectory, "terragrunt.hcl"))) {
        throw new CLIError(`${moduleDirectory} does not have the appropriate terragrunt.hcl configuration`)
    }

    const filePath = join(moduleDirectory, MODULE_STATUS_FILE)
    const existingStatus = await readYAMLFile({ context, filePath, validationSchema: MODULE_STATUS_FILE_SCHEMA })

    if (existingStatus) {
        const newStatus = existingStatus;
        if (initStatus) {
            newStatus.init_status = initStatus
        }

        if (deployStatus) {
            newStatus.deploy_status = deployStatus
        }
        await writeYAMLFile({ values: newStatus, overwrite: true, filePath, context })
    } else {
        await writeYAMLFile({
            values: {
                init_status: initStatus,
                deploy_status: deployStatus
            },
            overwrite: true,
            filePath,
            context
        })
    }
}