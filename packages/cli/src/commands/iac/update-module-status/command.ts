import { Command, Option } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { PanfactumZodError } from "@/util/error/error";
import { DEPLOY_STATUS_SCHEMA, INIT_STATUS_SCHEMA } from "@/util/terragrunt/schemas";
import { updateModuleStatus } from "@/util/terragrunt/updateModuleStatus";

export class UpdateModuleStatusCommand extends PanfactumCommand {
  static override paths = [["iac", "update-module-status"]];

  static override usage = Command.Usage({
    description: "Updates the local status file for a particular IaC module",
    category: 'Infrastructure as Code',
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
    const { context, directory } = this;
    const { initStatus, deployStatus } = this;

    let validatedInitStatus;
    if (initStatus) {
      const parseResult = INIT_STATUS_SCHEMA.safeParse(initStatus);
      if (!parseResult.success) {
        throw new PanfactumZodError("Invalid value for --init-status/-i", "--init-status/-i", parseResult.error);
      }
      validatedInitStatus = parseResult.data;
    }

    let validatedDeployStatus;
    if (deployStatus) {
      const parseResult = DEPLOY_STATUS_SCHEMA.safeParse(deployStatus);
      if (!parseResult.success) {
        throw new PanfactumZodError("Invalid value for --deploy-status/-d", "--deploy-status/-d", parseResult.error);
      }
      validatedDeployStatus = parseResult.data;
    }

    await updateModuleStatus({ context, initStatus: validatedInitStatus, deployStatus: validatedDeployStatus, moduleDirectory: directory })
  }
}