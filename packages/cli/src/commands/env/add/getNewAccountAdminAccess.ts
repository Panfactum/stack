import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { getAdminAccessCredentials } from "./getAdminAccessCredentials";
import type { PanfactumContext } from "@/util/context/context";

export async function getNewAccountAdminAccess(inputs: {
    context: PanfactumContext,
    type: "management" | "standalone" | "manual-org",
    environment: string;
}) {
    const { context, type, environment } = inputs

    if (type === "management") {
        context.logger.warn(`
            To create the ${MANAGEMENT_ENVIRONMENT} environment, you will need to create a new AWS account.
            Once the AWS Organization is deployed, AWS account provisioning can be fully automated. To manually create an account,
            go to this link:

            https://signin.aws.amazon.com/signup?request_type=register
        `, { highlights: ["new"] })

    } else if (type === "standalone") {
        context.logger.warn(`
            Since you are not utilizing AWS Organizations, you will
            need to create a new, standalone AWS account manually. To manually create an account, go to this link:

            https://signin.aws.amazon.com/signup?request_type=register
        `, { highlights: ["new"] })
    } else {
        context.logger.warn(`
            Since you are not connecting Panfactum to your AWS Organizations, you will
            need to manually create an organization account. Follow this documentation:

            https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_create.html
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
            "You cannot proceed without a new account. Follow the above link to create your AWS account."
        )
    }

    context.logger.info(`
        It can take a few minutes for AWS to fully activate a new account. When it is fully activated,
        you should receive an email with the subject line Your Amazon Web Services Account is Ready.
    `, { highlights: ["Your Amazon Web Services Account is Ready"] })

    while (true) {
        const ready = await context.logger.confirm({
            message: `Have you received the email?`,
        });

        if (ready) {
            break;
        }

        context.logger.warn(
            "Ok. Wait until you receive this email before proceeding."
        )
    }
    const username = `${environment}-superuser`
    context.logger.info(`
        For the installer to automatically complete the remaining setup, it needs access to an IAM user
        with the AdministratorAccess policy directly attached.
        You can create the user at this link:

        https://us-east-1.console.aws.amazon.com/iam/home?region=us-east-1#/users/create

        Use the following settings:

          * User name: ${username}

          * Provide user access to the AWS Management Console: unchecked

            -- Click Next --

          * Permission options: Attach policies directly

          * Permissions policies: AdministratorAccess (select)

            -- Click Next --

            -- Click Create user --
    `, {
        highlights: [
            username,
            "unchecked",
            "Attach policies directly",
            "Next",
            "Create user",
            "AdministratorAccess"
        ]
    })

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

    context.logger.info(`
        For the installer to proceed, it needs access to credentials for this new user.
        Click the following link to create those credentials:

        https://us-east-1.console.aws.amazon.com/iam/home?region=us-east-1#/users/details/${username}/create-access-key

        Use the following settings:

          * Use case: Command Line Interface (CLI)

          * Confirmation: checked

            -- Click Next --

          * Description tag value: Panfactum installer

            -- Click Create access key --

            -- Save the Access Key and Secret access key --
    `, {
        highlights: [
            "Command Line Interface (CLI)",
            "checked",
            "Panfactum installer",
            "Create access key",
            "Access Key",
            "Secret access key"
        ]
    })

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