import { IAMClient, ListAttachedUserPoliciesCommand } from "@aws-sdk/client-iam";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { input, password, confirm } from "@inquirer/prompts";
import { AWS_ACCESS_KEY_ID_SCHEMA, AWS_SECRET_KEY_SCHEMA } from "@/util/aws/schemas";
import { applyColors } from "@/util/colors/applyColors";
import type { PanfactumContext } from "@/context/context";


export async function getAdminAccessCredentials(context: PanfactumContext): Promise<{accessKeyId: string, secretAccessKey: string}> {
    let accessKeyId: string;
    let secretAccessKey: string;
    let username = ""
    while(true) {
        accessKeyId = await input({
            message: applyColors("AWS Access Key ID:", {style: "question"}),
            required: true,
            validate: (value) => {
                const { error } = AWS_ACCESS_KEY_ID_SCHEMA.safeParse(value);
                if (error) {
                    return applyColors(error.issues[0]?.message ?? "Invalid AWS Access Key ID", {style: "error"});
                }
                return true;
            }
        });
    
        secretAccessKey = await password({
            message: applyColors("AWS Secret Access Key:", {style: "question"}),
            mask: true,
            validate: async (value) => {
                const {error} = AWS_SECRET_KEY_SCHEMA.safeParse(value)
                if(error){
                    return applyColors(error.issues[0]?.message ?? "Invalid secret access key", {style: "error"})
                }
                return true
            },
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
            context.logger.log("Was not able to authenticate with the provided credentials.", { level: "error" });
            continue;
        }
    }

    // Second, make sure that AdministratorAccess is attached
    while(true){
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
            context.logger.log('Failed with error '+ JSON.stringify(e), {level: "debug"})
        }

        context.logger.log(`The provided credentials do not have AdministratorAccess policy attached to the IAM user '${username}'. Please attach the AdministratorAccess policy to the IAM user.`, { level: "error" });
        await confirm({
            message: applyColors(`Try again?`, {style: "question"}),
        });
    }


}