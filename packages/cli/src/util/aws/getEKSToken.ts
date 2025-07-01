// This file provides utilities for generating EKS authentication tokens
// It creates presigned STS GetCallerIdentity requests for Kubernetes authentication

import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { CLIError } from '../error/error';
import { getSTSClient } from './clients/getSTSClient';
import type { PanfactumContext } from '@/util/context/context';

/**
 * EKS token response matching Kubernetes ExecCredential format
 */
export interface IEKSTokenResponse {
  /** Resource kind - always 'ExecCredential' */
  kind: string;
  /** API version for client authentication */
  apiVersion: string;
  /** Empty spec object */
  spec: Record<string, never>;
  /** Token status with expiration and value */
  status: {
    /** ISO timestamp when the token expires */
    expirationTimestamp: string;
    /** Base64-encoded presigned URL token */
    token: string;
  };
}

/**
 * Input parameters for generating an EKS token
 */
export interface IGetEKSTokenParams {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Name of the EKS cluster */
  clusterName: string;
  /** AWS region where the cluster is located */
  region: string;
  /** AWS profile to use for authentication */
  awsProfile: string;
}

/**
 * Generates an EKS authentication token for kubectl access
 * 
 * @remarks
 * This function creates a Kubernetes-compatible authentication token for EKS
 * by generating a presigned STS GetCallerIdentity request. The token follows
 * the 'k8s-aws-v1' format expected by the AWS IAM Authenticator for Kubernetes.
 * The generated token expires after 15 minutes, matching AWS CLI behavior.
 * 
 * @param params - Configuration including context, cluster name, region, and profile
 * @returns EKS token response in Kubernetes ExecCredential format
 * 
 * @example
 * ```typescript
 * const token = await getEKSToken({
 *   context,
 *   clusterName: 'production-cluster',
 *   region: 'us-east-1',
 *   awsProfile: 'prod-admin'
 * });
 * console.log(`Token expires at: ${token.status.expirationTimestamp}`);
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when unable to create STS client or retrieve AWS credentials
 * 
 * @throws {@link CLIError}
 * Throws when unable to sign the STS request
 * 
 * @see {@link getSTSClient} - For STS client creation
 * @see https://github.com/kubernetes-sigs/aws-iam-authenticator - AWS IAM Authenticator documentation
 */
export async function getEKSToken(params: IGetEKSTokenParams): Promise<IEKSTokenResponse> {
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