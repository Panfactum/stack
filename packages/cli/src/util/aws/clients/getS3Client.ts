import { S3Client } from "@aws-sdk/client-s3";
import { getCredsFromFile } from "../getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getS3Client(inputs: { context: PanfactumContext, profile: string; region: string; }) {
    const { context, profile, region } = inputs;

    // This is necessary due to this bug
    // https://github.com/aws/aws-sdk-js-v3/issues/6872
    const credentials = await getCredsFromFile({ context, profile })

    if (credentials) {
        return new S3Client({
            credentials,
            region
        });
    } else {
        return new S3Client({
            profile,
            region
        });
    }

}