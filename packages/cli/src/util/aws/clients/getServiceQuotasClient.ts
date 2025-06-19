import { ServiceQuotasClient } from "@aws-sdk/client-service-quotas";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getServiceQuotasClient(inputs: { context: PanfactumContext, profile: string; region: string; }) {
    const { context, profile, region } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new ServiceQuotasClient({
            credentials,
            region
        });
    } else {
        return new ServiceQuotasClient({
            profile,
            region
        });
    }

}