// Utility to get EKS authentication tokens using AWS SDK with Zod validation
// Uses AWS SDK for direct token generation with proper error handling and type safety

import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { z, ZodError } from 'zod';
import { CLIError, PanfactumZodError } from '../error/error';
import { getSTSClient } from './clients/getSTSClient';
import type { PanfactumContext } from '@/util/context/context';

const EKS_TOKEN_SCHEMA = z.object({
  kind: z.string(),
  apiVersion: z.string(),
  spec: z.object({}),
  status: z.object({
    expirationTimestamp: z.string(),
    token: z.string()
  })
});

export type EKSTokenResponse = z.infer<typeof EKS_TOKEN_SCHEMA>;

export interface GetEKSTokenParams {
  context: PanfactumContext;
  clusterName: string;
  region: string;
  awsProfile: string;
}

export async function getEKSToken(params: GetEKSTokenParams): Promise<EKSTokenResponse> {
  const { context, clusterName, region, awsProfile } = params;
  try {
    context.logger.debug('Getting EKS authentication token', { clusterName, region, profile: awsProfile });
    
    // Get STS client with proper credential resolution (handles SSO, profiles, roles)
    const stsClient = await getSTSClient({ context, profile: awsProfile, region });
    
    // Get the resolved credentials from the STS client
    const credentials = await stsClient.config.credentials();
    
    // Create the presigned URL for GetCallerIdentity with EKS-specific headers
    const request = new HttpRequest({
      method: 'GET',
      protocol: 'https:',
      hostname: `sts.${region}.amazonaws.com`,
      path: '/',
      query: {
        Action: 'GetCallerIdentity',
        Version: '2011-06-15'
      },
      headers: {
        'x-k8s-aws-id': clusterName,
        'host': `sts.${region}.amazonaws.com`
      }
    });

    // Sign the request using AWS SDK v3 signature v4
    const signer = new SignatureV4({
      credentials,
      region,
      service: 'sts',
      sha256: Sha256
    });

    const signedRequest = await signer.presign(request, {
      expiresIn: 900 // 15 minutes, same as AWS CLI default
    });

    // Convert the signed request to a URL
    const url = new URL(`${signedRequest.protocol}//${signedRequest.hostname}${signedRequest.path}`);
    
    // Add query parameters from the signed request
    if (signedRequest.query) {
      Object.entries(signedRequest.query).forEach(([key, value]) => {
        if (typeof value === 'string') {
          url.searchParams.set(key, value);
        }
      });
    }

    // Create the EKS token (k8s-aws-v1. prefix + base64url encoded presigned URL)
    const token = 'k8s-aws-v1.' + Buffer.from(url.toString()).toString('base64url');
    
    // Calculate expiration timestamp (current time + 15 minutes)
    const expirationTime = new Date(Date.now() + 15 * 60 * 1000);
    
    // Construct response matching AWS CLI output format
    const response: EKSTokenResponse = {
      kind: 'ExecCredential',
      apiVersion: 'client.authentication.k8s.io/v1beta1',
      spec: {},
      status: {
        expirationTimestamp: expirationTime.toISOString(),
        token: token
      }
    };
    
    // Validate the response structure
    return EKS_TOKEN_SCHEMA.parse(response);
    
  } catch (error) {
    if (error instanceof ZodError) {
      throw new PanfactumZodError(
        `Invalid EKS token response format for cluster '${clusterName}' in region '${region}' with profile '${awsProfile}'`,
        'getEksToken',
        error
      );
    }
    throw new CLIError(
      `Failed to get EKS token for cluster '${clusterName}' in region '${region}' with profile '${awsProfile}'`,
      error
    );
  }
}