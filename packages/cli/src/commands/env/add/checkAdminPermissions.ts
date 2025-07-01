import { ListAttachedUserPoliciesCommand, NoSuchEntityException } from "@aws-sdk/client-iam";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { getIAMClient } from "@/util/aws/clients/getIAMClient.ts";
import { getSTSClient } from "@/util/aws/clients/getSTSClient";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Interface for checkAdminPermissions function inputs
 */
interface ICheckAdminPermissionsInputs {
    /** Panfactum context for logging and configuration */
    context: PanfactumContext;
    /** AWS profile to check for admin permissions */
    profile: string;
}

/**
 * Interface for checkAdminPermissions function output
 */
interface ICheckAdminPermissionsOutput {
    /** Status of the permission check */
    status: "success" | "invalidUsername" | "missingAdministratorAccess" | "invalidCredentials";
    /** AWS username if successfully retrieved */
    username?: string;
    /** AWS account ID if successfully retrieved */
    accountId?: string;
}

export async function checkAdminPermissions(inputs: ICheckAdminPermissionsInputs): Promise<ICheckAdminPermissionsOutput> {
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

    const username = identity.Arn?.split('/').pop() || "";
    const accountId = identity.Account;

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
    
    if (userPoliciesResponse.AttachedPolicies?.some(
        (policy) => policy.PolicyName === "AdministratorAccess"
    )) {
        return { status: "success", username };
    } else {
        return { status: "missingAdministratorAccess", username, accountId };
    }
}