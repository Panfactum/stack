import { confirm } from "@inquirer/prompts";
import { getAdminAccessCredentials } from "./getAdminAccessCredentials";
import type { PanfactumContext } from "@/util/context/context";

export async function getRootAccountAdminAccess(context: PanfactumContext) {
    context.logger.info(
        `
            To proceed, this installer needs AdministratorAccess to the management account for your AWS Organization.

            Please provision access keys for an IAM user in the management account with the AdministratorAccess policy attached.

            See our online documentation for more information. (TODO)
        `
    )

    while (true) {
        const ready = await confirm({
            message: `Have your retrieved those credentials?`
        });

        if (ready) {
            break;
        }

        context.logger.warn(
            "Ok. Follow the above guide to get those ready as you'll need them for the next steps."
        )
    }

    // TODO: Need to verify that this is the root account
    return getAdminAccessCredentials(context)
}