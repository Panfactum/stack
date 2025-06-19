import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { CLIError } from '../error/error';
import { getSTSClient } from './clients/getSTSClient';
import type { PanfactumContext } from '@/util/context/context';

export interface EKSTokenResponse {
  kind: string;
  apiVersion: string;
  spec: Record<string, never>;
  status: {
    expirationTimestamp: string;
    token: string;
  };
}

export interface GetEKSTokenParams {
  context: PanfactumContext;
  clusterName: string;
  region: string;
  awsProfile: string;
}

export async function getEKSToken(params: GetEKSTokenParams): Promise<EKSTokenResponse> {
  const { context, clusterName, region, awsProfile } = params;
  
  context.logger.debug('Getting EKS authentication token', { clusterName, region, profile: awsProfile });
  
  // Get STS client with proper credential resolution (handles SSO, profiles, roles)
  const stsClient = await getSTSClient({ context, profile: awsProfile, region })
    .catch((error: unknown) => {
      throw new CLIError(
        `Failed to create STS client for cluster '${clusterName}' in region '${region}' with profile '${awsProfile}'`,
        error
      );
    });
  
  // Get the resolved credentials from the STS client
  const credentials = await stsClient.config.credentials()
    .catch((error: unknown) => {
      throw new CLIError(
        `Failed to get AWS credentials for cluster '${clusterName}' in region '${region}' with profile '${awsProfile}'`,
        error
      );
    });
  
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
  }).catch((error: unknown) => {
    throw new CLIError(
      `Failed to sign request for cluster '${clusterName}' in region '${region}' with profile '${awsProfile}'`,
      error
    );
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
  const response = {
    kind: 'ExecCredential',
    apiVersion: 'client.authentication.k8s.io/v1beta1',
    spec: {},
    status: {
      expirationTimestamp: expirationTime.toISOString(),
      token: token
    }
  };
  
  return response;
}