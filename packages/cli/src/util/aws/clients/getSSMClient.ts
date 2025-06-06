import { SSMClient } from "@aws-sdk/client-ssm";
import { getCredsFromFile } from "../getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getSSMClient(inputs: { 
  context: PanfactumContext; 
  profile: string; 
  region: string;
}) {
  const { context, profile, region } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = await getCredsFromFile({ context, profile });

  if (credentials) {
    return new SSMClient({
      credentials,
      region
    });
  } else {
    return new SSMClient({
      profile,
      region
    });
  }
}