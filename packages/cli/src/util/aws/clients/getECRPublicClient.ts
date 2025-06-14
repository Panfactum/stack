import { ECRPUBLICClient } from "@aws-sdk/client-ecr-public";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getECRPublicClient(inputs: { 
  context: PanfactumContext; 
  profile?: string; 
  region?: string;
}) {
  const { context, profile, region = "us-east-1" } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = profile ? await getCredsFromFile({ context, profile }) : undefined;

  if (credentials) {
    return new ECRPUBLICClient({
      credentials,
      region
    });
  } else {
    return new ECRPUBLICClient({
      profile: profile || undefined,
      region
    });
  }
}