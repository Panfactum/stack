import { confirm } from "@inquirer/prompts";
import pc from "picocolors"
import { getAdminAccessCredentials } from "./getAdminAccessCredentials";
import type { PanfactumContext } from "@/context/context";

export async function getNewAccountAdminAccess(inputs: { context: PanfactumContext, type: "management" | "standalone" | "manual-org" }) {
    const { context, type} = inputs

    if (type === "management") {
        context.logger.log(
            "To start using AWS Organizations, we you will need to create a new AWS account.\n" +
            "Once your AWS organization is created, this can be automated.\n" +
            "For now, please follow the step-by-step instructions here. (TODO)", // TODO"
            { trailingNewlines: 1 }
        )
    } else if(type === "standalone") {
        context.logger.log(
            "Since you are not utilizing AWS Organizations, you will\n" +
            "need to create a standalone AWS account and provide this installer 'AdministratorAccess' credentials.\n" +
            "Please follow the step-by-step instructions here. (TODO)", // TODO"
            { trailingNewlines: 1 }
        )
    } else {
        context.logger.log(
            "Since you are not connecting Panfactum to your AWS Organizations, you will\n" +
            "need to manually create an organization account and provide  this installer 'AdministratorAccess' credentials.\n" +
            "Please follow the step-by-step instructions here. (TODO)", // TODO"
            { trailingNewlines: 1 }
        )
    }


    while (true) {
        const ready = await confirm({
            message: pc.magenta(`Do you have access to the IAM user credentials for your new account?`),
        });

        if (ready) {
            break;
        }

        context.logger.log(
            "Ok. Follow the above guide to get those ready as you'll need them for the next steps.",
            { trailingNewlines: 1, leadingNewlines: 1 }
        )
    }


    return getAdminAccessCredentials(context)
}