import { ListAttachedUserPoliciesCommand, NoSuchEntityException } from "@aws-sdk/client-iam";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { getIAMClient } from "@/util/aws/clients/getIAMClient.ts";
import { getSTSClient } from "@/util/aws/clients/getSTSClient";
import type { PanfactumContext } from "@/util/context/context";

export async function checkAdminPermissions(inputs: { context: PanfactumContext, profile: string }): Promise<{
    status: "success" | "invalidUsername" | "missingAdministratorAccess" | "invalidCredentials",
    username?: string;
    accountId?: string;
}> {
    const stsClient = await getSTSClient(inputs)

    let username, accountId;
    try {
        const identity = await stsClient.send(new GetCallerIdentityCommand({}));
        username = identity.Arn?.split('/').pop() || "";
        accountId = identity.Account
    } catch {
        return { status: "invalidCredentials" }
    }

    if (username === "") {
        return { status: "invalidUsername" }
    }

    const iamClient = await getIAMClient(inputs)
    try {
        const userPoliciesResponse = await iamClient.send(new ListAttachedUserPoliciesCommand({
            UserName: username
        }));

        if (userPoliciesResponse.AttachedPolicies?.some(
            (policy: { PolicyName?: string }) => policy.PolicyName === "AdministratorAccess"
        )) {
            return { status: "success", username }
        } else {
            return { status: "missingAdministratorAccess", username, accountId }
        }
    } catch (e) {
        if (e instanceof NoSuchEntityException) {
            return { status: "invalidUsername" }
        } else {
            return { status: "missingAdministratorAccess", username, accountId }
        }
    }

}