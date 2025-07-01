import { IAMClient } from "@aws-sdk/client-iam";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getIAMClient(inputs: { context: PanfactumContext, profile: string; }) {
    const { context, profile } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new IAMClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        return new IAMClient({
            profile,
            region: "us-east-1"
        });
    }

}