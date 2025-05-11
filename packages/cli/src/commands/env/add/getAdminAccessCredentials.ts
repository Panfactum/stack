import { IAMClient, ListAttachedUserPoliciesCommand } from "@aws-sdk/client-iam";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { AWS_ACCESS_KEY_ID_SCHEMA, AWS_SECRET_KEY_SCHEMA } from "@/util/aws/schemas";
import type { PanfactumContext } from "@/util/context/context";


export async function getAdminAccessCredentials(context: PanfactumContext): Promise<{ accessKeyId: string, secretAccessKey: string }> {
    let accessKeyId: string;
    let secretAccessKey: string;
    let username = ""

    while (true) {
        while (true) {
            accessKeyId = await context.logger.input({
                message: "AWS Access Key:",
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
                        return error.issues[0]?.message ?? "Invalid AWS Secret Access Key";
                    }
                    return true;
                }
            });

            // First, check the credentials are valid
            try {
                const stsClient = new STSClient({
                    region: "us-east-1",
                    credentials: {
                        accessKeyId,
                        secretAccessKey
                    }
                });
                const identity = await stsClient.send(new GetCallerIdentityCommand({}));
                username = identity.Arn?.split('/').pop() || "";

                if (username.endsWith(":root")) {
                    context.logger.error(`
                        You have provided credentials for the AWS account root user. For security,
                        this installer requires that you use a non-root IAM user instead.

                        For information on the difference between an IAM user and the root account user
                        see these docs:

                        https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html  
                    `, { highlights: ["non-root"] });
                    continue;
                }
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
                    region: "us-east-1",
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

                context.logger.error(`
                    The provided credentials do not have the AdministratorAccess policy attached 
                    to the IAM user '${username}'. Please attach the AdministratorAccess policy to the IAM user.
                `, { highlights: [username, "AdministratorAccess"] });

            } catch (e) {
                context.logger.error(`
                    An unknown error occurred when validating the provided credentials. This is either
                    because the credentials are incorrect or there is a bug in this installer:

                    ${e instanceof Error ? e.message : ""}

                    Please try again.
                `);
                context.logger.debug('Failed with error ' + JSON.stringify(e))
            }

            const tryAgain = await context.logger.confirm({
                message: "Try again with the same credentials?",
            });

            if (!tryAgain) {
                context.logger.info("Removing existing credentials and requesting new ones:")
                break;
            }
        }
    }
}