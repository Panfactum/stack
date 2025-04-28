import { AWS_ACCOUNT_ALIAS_SCHEMA } from "@/util/aws/schemas";
import type { PanfactumContext } from "@/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function getNewAccountAlias(inputs: {
    context: PanfactumContext,
    defaultAlias?: string;
    task: PanfactumTaskWrapper;
    denylist?: string[];
}) {
    const { context, task, defaultAlias, denylist = [] } = inputs;
    return context.logger.input({
        explainer: {
            message: "Even though your environment name only needs to be unique to your organization, AWS requires a globally unique name for the underlying AWS account.",
            highlights: ["globally"]
        },
        task,
        message: 'Unique Account Name:',
        default: defaultAlias,
        validate: async (value) => {
            const { error } = AWS_ACCOUNT_ALIAS_SCHEMA.safeParse(value)
            if (error) {
                return error.issues[0]?.message ?? "Invalid account name"
            }
            if (denylist.includes(value)) {
                return "Account name is already in use by your organization."
            }
            const response = await globalThis.fetch(`https://${value}.signin.aws.amazon.com`)
            if (response.status !== 404) {
                return `Every account must have a globally unique name. Name is already taken.`
            }
            return true
        }
    });
}