import { OrganizationsClient } from "@aws-sdk/client-organizations";
import { getCredsFromFile } from "../getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getOrganizationsClient(inputs: { context: PanfactumContext, profile: string; }) {
    const { context, profile } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new OrganizationsClient({
            credentials,
            region: "us-east-1"
        });
    } else {
        return new OrganizationsClient({
            profile,
            region: "us-east-1"
        });
    }

}