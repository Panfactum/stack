import { STSClient } from "@aws-sdk/client-sts";
import { getCredsFromFile } from "../getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getSTSClient(inputs: { context: PanfactumContext, profile: string; }) {
    const { context, profile } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new STSClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        return new STSClient({
            profile,
            region: "us-east-1"
        });
    }

}