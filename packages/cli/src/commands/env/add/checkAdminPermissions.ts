import { ListAttachedUserPoliciesCommand, NoSuchEntityException } from "@aws-sdk/client-iam";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { z } from "zod";
import { getIAMClient } from "@/util/aws/clients/getIAMClient.ts";
import { getSTSClient } from "@/util/aws/clients/getSTSClient";
import { CLIError, PanfactumZodError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

// Zod schemas for AWS API responses
const getCallerIdentityResponseSchema = z.object({
    Arn: z.string().optional(),
    Account: z.string().optional(),
    UserId: z.string().optional()
}).passthrough();

const listAttachedUserPoliciesResponseSchema = z.object({
    AttachedPolicies: z.array(z.object({
        PolicyName: z.string().optional(),
        PolicyArn: z.string().optional()
    }).passthrough()).optional()
}).passthrough();

export async function checkAdminPermissions(inputs: { context: PanfactumContext, profile: string }): Promise<{
    status: "success" | "invalidUsername" | "missingAdministratorAccess" | "invalidCredentials",
    username?: string;
    accountId?: string;
}> {
    const stsClient = await getSTSClient(inputs)
        .catch((error: unknown) => {
            throw new CLIError(
                `Failed to create STS client for profile '${inputs.profile}'`,
                error
            );
        });

    const identity = await stsClient.send(new GetCallerIdentityCommand({}))
        .catch(() => {
            // If we can't get caller identity, credentials are invalid
            return null;
        });
    
    if (!identity) {
        return { status: "invalidCredentials" };
    }

    // Validate the response
    const identityValidation = getCallerIdentityResponseSchema.safeParse(identity);
    if (!identityValidation.success) {
        throw new PanfactumZodError(
            "Invalid caller identity response format",
            "STS GetCallerIdentity API",
            identityValidation.error
        );
    }

    const validatedIdentity = identityValidation.data;
    const username = validatedIdentity.Arn?.split('/').pop() || "";
    const accountId = validatedIdentity.Account;

    if (username === "") {
        return { status: "invalidUsername" };
    }

    const iamClient = await getIAMClient(inputs)
        .catch((error: unknown) => {
            throw new CLIError(
                `Failed to create IAM client for profile '${inputs.profile}'`,
                error
            );
        });

    const userPoliciesResponse = await iamClient.send(new ListAttachedUserPoliciesCommand({
        UserName: username
    })).catch((error: unknown) => {
        if (error instanceof NoSuchEntityException) {
            return "invalidUsername";
        }
        // Any other error means missing permissions
        return null;
    });

    if (userPoliciesResponse === "invalidUsername") {
        return { status: "invalidUsername" };
    }

    if (!userPoliciesResponse) {
        return { status: "missingAdministratorAccess", username, accountId };
    }

    // Validate the response
    const policiesValidation = listAttachedUserPoliciesResponseSchema.safeParse(userPoliciesResponse);
    if (!policiesValidation.success) {
        throw new PanfactumZodError(
            "Invalid user policies response format",
            "IAM ListAttachedUserPolicies API",
            policiesValidation.error
        );
    }

    const validatedResponse = policiesValidation.data;
    
    if (validatedResponse.AttachedPolicies?.some(
        (policy) => policy.PolicyName === "AdministratorAccess"
    )) {
        return { status: "success", username };
    } else {
        return { status: "missingAdministratorAccess", username, accountId };
    }
}