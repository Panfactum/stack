import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2'
import { getCredsFromFile } from '@/util/aws/getCredsFromFile'
import type { PanfactumContext } from '@/util/context/context'

export const getELBv2Client = async (params: {
  context: PanfactumContext
  profile?: string
  region?: string
}) => {
  const { context, profile, region = 'us-east-1' } = params

  // This is necessary due to this bug
  // https://github.com/aws/aws-sdk-js-v3/issues/6872
  const credentials = profile ? await getCredsFromFile({ context, profile }) : undefined

  if (credentials) {
    return new ElasticLoadBalancingV2Client({
      credentials,
      region
    })
  } else {
    return new ElasticLoadBalancingV2Client({
      profile,
      region
    })
  }
}