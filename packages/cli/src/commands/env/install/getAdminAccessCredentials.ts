import { IAMClient, ListAttachedUserPoliciesCommand } from "@aws-sdk/client-iam";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { AWS_ACCESS_KEY_ID_SCHEMA, AWS_SECRET_KEY_SCHEMA } from "@/util/aws/schemas";
import type { PanfactumContext } from "@/context/context";


export async function getAdminAccessCredentials(context: PanfactumContext): Promise<{ accessKeyId: string, secretAccessKey: string }> {
    let accessKeyId: string;
    let secretAccessKey: string;
    let username = ""
    while (true) {
        accessKeyId = await context.logger.input({
            message: "AWS Access Key ID:",
            validate: (value) => {
                const { error } = AWS_ACCESS_KEY_ID_SCHEMA.safeParse(value);
                if (error) {
                    return error.issues[0]?.message ?? "Invalid AWS Access Key ID";
                }
                return true;
            }
        });

        secretAccessKey = await context.logger.password({
            message: "AWS Secret Access Key:",
            validate: (value) => {
                const { error } = AWS_SECRET_KEY_SCHEMA.safeParse(value);
                if (error) {
                    return error.issues[0]?.message ?? "Invalid secret access key";
                }
                return true;
            }
        });

        // First, check the credentials are valid
        try {
            const stsClient = new STSClient({
                credentials: {
                    accessKeyId,
                    secretAccessKey
                }
            });
            const identity = await stsClient.send(new GetCallerIdentityCommand({}));
            username = identity.Arn?.split('/').pop() || "";
            break;
        } catch {
            context.logger.error("Was not able to authenticate with the provided credentials.");
            continue;
        }
    }

    // Second, make sure that AdministratorAccess is attached
    while (true) {
        try {
            const iamClient = new IAMClient({
                credentials: {
                    accessKeyId,
                    secretAccessKey
                }
            });

            const userPoliciesResponse = await iamClient.send(new ListAttachedUserPoliciesCommand({
                UserName: username
            }));

            const hasAdminAccess = userPoliciesResponse.AttachedPolicies?.some(
                (policy: { PolicyName?: string }) => policy.PolicyName === "AdministratorAccess"
            );

            if (hasAdminAccess) {
                return { accessKeyId, secretAccessKey };


            }

        } catch (e) {
            context.logger.debug('Failed with error ' + JSON.stringify(e))
        }

        context.logger.error(`The provided credentials do not have AdministratorAccess policy attached to the IAM user '${username}'. Please attach the AdministratorAccess policy to the IAM user.`);
        await context.logger.confirm({
            message: "Try again?",
        });
    }
}