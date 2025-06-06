import { AutoScalingClient } from "@aws-sdk/client-auto-scaling";
import { getCredsFromFile } from "../getCredsFromFile";
import type { PanfactumContext } from "@/util/context/context";

export async function getAutoScalingClient(inputs: { 
  context: PanfactumContext; 
  profile: string; 
  region: string;
}) {
  const { context, profile, region } = inputs;

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = await getCredsFromFile({ context, profile });

  if (credentials) {
    return new AutoScalingClient({
      credentials,
      region
    });
  } else {
    return new AutoScalingClient({
      profile,
      region
    });
  }
}