import { OrganizationsClient, ListAccountsCommand } from "@aws-sdk/client-organizations";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for getAccountEmail function inputs
 */
interface IGetAccountEmailInputs {
  /** Panfactum context for logging */
  context: PanfactumContext;
  /** AWS Organizations client for account operations */
  orgClient: OrganizationsClient;
}

// Returns and email address associated with an existing AWS account
// Note this is not guaranteed to be the email of any particular account
// and this only works when the account is a part of an AWS organization.
// As a result, DO NOT USE THIS outside of this `env add` command context
export async function getAccountEmail(inputs: IGetAccountEmailInputs): Promise<string | null> {

    const { context, orgClient } = inputs;

    const listAccountsCommand = new ListAccountsCommand({});
    const response = await orgClient.send(listAccountsCommand)
        .catch((error: unknown) => {
            // Log and return null - this is a best-effort operation
            context.logger.debug(
                `Could not retrieve account email from AWS: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        });

    if (!response) {
        return null;
    }

    const accounts = response.Accounts || [];

    if (accounts.length > 0 && accounts[0]) {
        const email = accounts[0].Email;
        if (email) {
            return email;
        }
    }

    return null;
}