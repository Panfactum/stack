import { AccountClient } from "@aws-sdk/client-account";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getAccountClient(inputs: { context: PanfactumContext, profile: string; }) {
    const { context, profile } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new AccountClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        return new AccountClient({
            profile,
            region: "us-east-1"
        });
    }

}