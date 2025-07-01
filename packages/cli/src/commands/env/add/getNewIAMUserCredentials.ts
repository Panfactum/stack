import { failsafeOpen } from "@/util/browser/failsafeOpen";
import { getAdminAccessCredentials } from "./getAdminAccessCredentials";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for getNewIAMUserCredentials function inputs
 */
interface IGetNewIAMUserCredentialsInputs {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Environment name for user creation */
  environment: string;
}

export async function getNewIAMUserCredentials(inputs: IGetNewIAMUserCredentialsInputs) {
    const { context, environment } = inputs;

    const username = `${environment}-superuser`
    const createURL = "https://us-east-1.console.aws.amazon.com/iam/home?region=us-east-1#/users/create"
    context.logger.info(`
        For the installer to automatically complete the remaining setup, it needs access to a new IAM user
        with the AdministratorAccess policy directly attached.
        You can create the user at this link:

        ${createURL}

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
    await failsafeOpen(createURL)

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

    const credentialURL = `https://us-east-1.console.aws.amazon.com/iam/home?region=us-east-1#/users/details/${username}/create-access-key`
    context.logger.info(`
        For the installer to proceed, it needs access to credentials for this new user.
        Click the following link to create those credentials:

        ${credentialURL}

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
    await failsafeOpen(credentialURL)

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