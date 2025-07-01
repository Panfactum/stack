import { failsafeOpen } from "@/util/browser/failsafeOpen";
import { MANAGEMENT_ENVIRONMENT } from "@/util/terragrunt/constants";
import { getNewIAMUserCredentials } from "./getNewIAMUserCredentials";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for getNewAccountAdminAccess function input
 */
interface IGetNewAccountAdminAccessInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Type of account setup */
  type: "management" | "standalone" | "manual-org";
  /** Environment name being set up */
  environment: string;
}

export async function getNewAccountAdminAccess(inputs: IGetNewAccountAdminAccessInput) {
    const { context, type, environment } = inputs

    const newAccountURL = "https://signin.aws.amazon.com/signup?request_type=register"
    if (type === "management") {
        await failsafeOpen(newAccountURL)
        context.logger.warn(`
            To create the ${MANAGEMENT_ENVIRONMENT} environment, you will need to create a new AWS account.
            Once the AWS Organization is deployed, AWS account provisioning can be fully automated. To manually create an account,
            go to this link:

            ${newAccountURL}
        `, { highlights: ["new"] })

    } else if (type === "standalone") {
        context.logger.warn(`
            Since you are not utilizing AWS Organizations, you will
            need to create a new, standalone AWS account manually. To manually create an account, go to this link:

            ${newAccountURL}
        `, { highlights: ["new"] })
        await failsafeOpen(newAccountURL)
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
    return getNewIAMUserCredentials({ environment, context })
}