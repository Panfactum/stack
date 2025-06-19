import { OrganizationsClient, ListAccountsCommand } from "@aws-sdk/client-organizations";
import { z } from "zod";
import { PanfactumZodError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

// Zod schema for AWS Organizations API response
const listAccountsResponseSchema = z.object({
    Accounts: z.array(z.object({
        Id: z.string().optional(),
        Arn: z.string().optional(),
        Email: z.string().optional(),
        Name: z.string().optional(),
        Status: z.string().optional(),
        JoinedMethod: z.string().optional(),
        JoinedTimestamp: z.date().optional()
    }).passthrough()).optional(),
    NextToken: z.string().optional()
}).passthrough();

// Returns and email address associated with an existing AWS account
// Note this is not guaranteed to be the email of any particular account
// and this only works when the account is a part of an AWS organization.
// As a result, DO NOT USE THIS outside of this `env add` command context
export async function getAccountEmail(inputs: { context: PanfactumContext, orgClient: OrganizationsClient }): Promise<string | null> {

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

    // Validate the response
    const validationResult = listAccountsResponseSchema.safeParse(response);
    if (!validationResult.success) {
        throw new PanfactumZodError(
            "Invalid list accounts response format",
            "Organizations ListAccounts API",
            validationResult.error
        );
    }

    const accounts = validationResult.data.Accounts || [];

    if (accounts.length > 0 && accounts[0]) {
        const email = accounts[0].Email;
        if (email) {
            return email;
        }
    }

    return null;
}