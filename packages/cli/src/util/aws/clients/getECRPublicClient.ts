import { ECRPUBLICClient } from "@aws-sdk/client-ecr-public";
import { getCredsFromFile } from "@/util/aws/getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getECRPublicClient(inputs: { 
  context: PanfactumContext; 
  profile: string;
}) {
  const { context, profile } = inputs;
  const region = 'us-east-1'; // ECR Public is only available in us-east-1

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = await getCredsFromFile({ context, profile });

  if (credentials) {
    return new ECRPUBLICClient({
      credentials,
      region
    });
  } else {
    return new ECRPUBLICClient({
      profile,
      region
    });
  }
}