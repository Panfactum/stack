import { Route53DomainsClient } from "@aws-sdk/client-route-53-domains";
import { getCredsFromFile } from "../getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getRoute53DomainsClient(inputs: { context: PanfactumContext, profile: string; }) {
    const { context, profile } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new Route53DomainsClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        return new Route53DomainsClient({
            profile,
            region: "us-east-1"
        });
    }

}