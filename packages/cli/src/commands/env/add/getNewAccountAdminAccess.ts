import { getAdminAccessCredentials } from "./getAdminAccessCredentials";
import type { PanfactumContext } from "@/context/context";

export async function getNewAccountAdminAccess(inputs: { context: PanfactumContext, type: "management" | "standalone" | "manual-org" }) {
    const { context, type } = inputs

    // TODO: @jack Add documentation for each of these steps
    if (type === "management") {
        context.logger.warn(`
            To start using AWS Organizations, you will need to create a new AWS account.
            Once this installer completes, AWS account provisioning can be fully automated. To create an account,
            go to this link:

            https://signin.aws.amazon.com/signup?request_type=register
        `, { highlights: ["new"] })

    } else if (type === "standalone") {
        context.logger.warn(`
            Since you are not utilizing AWS Organizations, you will
            need to create a new, standalone AWS account manually. To create an account, go to this link:

            https://signin.aws.amazon.com/signup?request_type=register
        `, { highlights: ["new"] })
    } else {
        // TODO: Improve instructions
        context.logger.warn(`
            Since you are not connecting Panfactum to your AWS Organizations, you will
            need to manually create an organization account.
        `)
    }


    while (true) {
        const ready = await context.logger.confirm({
            message: { message: `Have you created a new account?`, highlights: ["new"] },
        });

        if (ready) {
            break;
        }

        context.logger.warn(
            "Ok. Use the above link to create your AWS account."
        )
    }

    context.logger.warn(`
        For the installer to automatically complete the remaining setup, it needs access to an IAM user
        with the 'AdministratorAccess' managed policy attached directly. You can do that here:

        https://us-east-1.console.aws.amazon.com/iam/home#/users

        This should NOT be the AWS account root user:

        https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html
    `, { highlights: ["NOT"] })

    while (true) {
        const ready = await context.logger.confirm({
            message: `Have you created the IAM user?`,
        });

        if (ready) {
            break;
        }

        context.logger.warn(
            "Ok. Please use the above link to create the new IAM user."
        )
    }

    context.logger.warn(`
        For the installer to proceed, it needs access to credentials for this new user.
        Please follow this documentation to create those credentials:

        https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
    `)

    while (true) {
        const ready = await context.logger.confirm({
            message: `Do you have access to the IAM user credentials for your new account?`,
        });

        if (ready) {
            break;
        }

        context.logger.warn(
            "Ok. Follow the above guide to get those ready as you'll need them for the next step."
        )
    }


    return getAdminAccessCredentials(context)
}