import { confirm } from "@inquirer/prompts";
import pc from "picocolors"
import { getAdminAccessCredentials } from "./getAdminAccessCredentials";
import type { PanfactumContext } from "@/context/context";

export async function getRootAccountAdminAccess(context: PanfactumContext) {
    context.logger.log(
        "To proceed, this installer needs AdministratorAccess to the management account for your AWS Organization.\n\n" +
        "Please provision access keys for an IAM user in the management account with the AdministratorAccess policy attached.\n\n" +
        "See our online documentation for more information. (TODO)", // TODO
        {trailingNewlines: 1, leadingNewlines: 1}
    )

    while(true){
        const ready = await confirm({
            message: pc.magenta(`Have your retrieved those credentials?`),
        });

        if(ready){
            break;
        }

        context.logger.log(
            "Ok. Follow the above guide to get those ready as you'll need them for the next steps.",
            {trailingNewlines: 1, leadingNewlines: 1}
        )
    }
    
    // TODO: Need to verify that this is the root account
    return getAdminAccessCredentials(context)
}