import { join } from "node:path";
import { Command, Option } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";
import { parseErrorHandler } from "@/util/error/parseErrorHandler";
import { directoryExists } from "@/util/fs/directoryExist";
import { MODULE_STATUS_FILE } from "@/util/terragrunt/constants";
import { DEPLOY_STATUS_SCHEMA, INIT_STATUS_SCHEMA, MODULE_STATUS_FILE_SCHEMA } from "@/util/terragrunt/schemas";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import type { z } from "zod";

export class UpdateModuleStatusCommand extends PanfactumCommand {
  static override paths = [["iac", "update-module-status"]];

  static override usage = Command.Usage({
    description: "Updates the local status file for a particular IaC module"
  });

  directory: string = Option.String("--module-directory,-m", {
    description: "The directory of the module whose status will be updated",
    arity: 1,
    required: true
  });

  initStatus: string | undefined = Option.String("--init-status,-i", {
    description: "The updated 'initStatus': pending, success, error",
    arity: 1
  });

  deployStatus: string | undefined = Option.String("--deploy-status,-d", {
    description: "The updated 'deployStatus': pending, success, error",
    arity: 1
  });

  async execute() {
    const { context, directory, initStatus, deployStatus } = this;

    const updates: {
      init_status?: z.infer<typeof INIT_STATUS_SCHEMA>
      deploy_status?: z.infer<typeof DEPLOY_STATUS_SCHEMA>
    } = {}

    if (initStatus) {
      try {
        updates.init_status = INIT_STATUS_SCHEMA.parse(initStatus)
      } catch (error) {
        parseErrorHandler({ error, errorMessage: "Invalid value for --init-status/-i", location: "--init-status/-i" })
      }
    }

    if (deployStatus) {
      try {
        updates.deploy_status = DEPLOY_STATUS_SCHEMA.parse(deployStatus)
      } catch (error) {
        parseErrorHandler({ error, errorMessage: "Invalid value for --deploy-status/-d", location: "--deploy-status/-d" })
      }
    }

    if (! await directoryExists(directory)) {
      throw new CLIError(`Cannot update the status of a module with non-existant directory ${directory}`)
    }

    const filePath = join(directory, MODULE_STATUS_FILE)
    const existingStatus = await readYAMLFile({ context, filePath, validationSchema: MODULE_STATUS_FILE_SCHEMA })
    const newStatus = existingStatus ? { existingStatus, ...updates } : updates
    await writeYAMLFile({ values: newStatus, overwrite: true, filePath, context })
  }
}