import { confirm } from "@inquirer/prompts";
import { getAdminAccessCredentials } from "./getAdminAccessCredentials";
import type { PanfactumContext } from "@/context/context";

export async function getNewAccountAdminAccess(inputs: { context: PanfactumContext, type: "management" | "standalone" | "manual-org" }) {
    const { context, type } = inputs

    // TODO: @jack Add documentation for each of these steps
    if (type === "management") {
        context.logger.info(`
            To start using AWS Organizations, we you will need to create a new AWS account and provide this installer 'AdministratorAccess' credentials.
            Once this installer creates your AWS Organization, AWS account provisioning can be fully automated.
        `)
    } else if (type === "standalone") {
        context.logger.info(`
            Since you are not utilizing AWS Organizations, you will
            need to create a standalone AWS account and provide this installer 'AdministratorAccess' credentials.
        `)
    } else {
        context.logger.info(`
            Since you are not connecting Panfactum to your AWS Organizations, you will
            need to manually create an organization account and provide this installer 'AdministratorAccess' credentials.
        `)
    }

    while (true) {
        const ready = await confirm({
            message: `Do you have access to the IAM user credentials for your new account?`,
        });

        if (ready) {
            break;
        }

        context.logger.warn(
            "Ok. Follow the above guide to get those ready as you'll need them for the next steps."
        )
    }


    return getAdminAccessCredentials(context)
}