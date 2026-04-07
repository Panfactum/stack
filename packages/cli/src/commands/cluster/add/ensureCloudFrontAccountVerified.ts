// This file provides a pre-flight check that verifies the AWS account is permitted
// to create CloudFront resources before any infrastructure is touched. New AWS accounts
// are subject to a fraud-prevention hold that gates all CloudFront resource creation
// until the user opens an AWS Support case. Detecting this up front saves the user
// ~30 minutes of EC2/EKS/Vault deployment that would otherwise fail deep into the
// install process.

import { randomBytes } from "crypto";
import {
  CreateCloudFrontOriginAccessIdentityCommand,
  DeleteCloudFrontOriginAccessIdentityCommand,
  ListDistributionsCommand,
  type CloudFrontClient,
} from "@aws-sdk/client-cloudfront";
import { getCloudFrontClient } from "@/util/aws/clients/getCloudFrontClient";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for ensureCloudFrontAccountVerified
 */
export interface IEnsureCloudFrontAccountVerifiedInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name for authentication */
  profile: string;
}

/**
 * Confirms that the AWS account is verified for CloudFront resource creation
 *
 * @remarks
 * New AWS accounts are subject to an account-verification hold that AWS applies
 * to all CloudFront resource-creation API calls. The hold returns an HTTP 403
 * with `AccessDenied` and a message containing "must be verified". Resolving the
 * hold requires opening an AWS Support case ("Service quota increase" →
 * "CloudFront" → "Distributions per AWS account") and waiting 1–2 business days.
 *
 * Panfactum's default cluster configuration deploys CloudFront distributions
 * (via the `kube_vault`, `kube_authentik`, `kube_grist`, `kube_nocodb`, and
 * `kube_opensearch` modules), so this hold will reliably break a fresh
 * `pf cluster add` ~30 minutes into the install. This pre-flight check fails
 * fast with actionable guidance instead.
 *
 * Detection algorithm:
 * 1. Call `ListDistributions` (with `MaxItems: "1"`). If the account already
 *    has any distribution, the account is definitively verified — return.
 * 2. Otherwise, probe by creating a CloudFront Origin Access Identity (OAI).
 *    OAI creation is gated by the same verification check as `CreateDistribution`
 *    but is free, harmless, and fast. Always immediately delete any OAI we
 *    successfully create via `try`/`finally`.
 * 3. Classify any error from the probe:
 *    - 403 + AccessDenied + "must be verified" → throw a verification CLIError
 *      with AWS Support instructions.
 *    - 403 + AccessDenied (any other message) → throw a permissions CLIError
 *      indicating the IAM principal lacks required CloudFront permissions.
 *    - Any other error (network, throttling, 5xx) → debug-log and return so
 *      that an unrelated transient failure does not block the install.
 *
 * @param input - Configuration including AWS profile and Panfactum context
 * @returns Resolves when verification has been confirmed (or the check has
 *          fallen through due to a non-actionable error)
 *
 * @example
 * ```typescript
 * await ensureCloudFrontAccountVerified({
 *   context,
 *   profile: 'production',
 * });
 * ```
 *
 * @throws {@link CLIError}
 * Throws when the AWS account has not been verified for CloudFront resource
 * creation, or when the IAM principal lacks the required CloudFront permissions.
 *
 * @see {@link getCloudFrontClient} - CloudFront client factory
 */
export async function ensureCloudFrontAccountVerified(
  input: IEnsureCloudFrontAccountVerifiedInput
): Promise<void> {
  const { context, profile } = input;

  const client = await getCloudFrontClient({ context, profile });

  /***********************************************
   * Step 1: Short-circuit if any distribution exists
   ***********************************************/
  const alreadyHasDistribution = await hasExistingDistribution({
    client,
    context,
  });
  if (alreadyHasDistribution) {
    context.logger.debug(
      "Account already has at least one CloudFront distribution; skipping verification probe."
    );
    return;
  }

  /***********************************************
   * Step 2: Probe via CreateCloudFrontOriginAccessIdentity
   ***********************************************/
  await probeViaOriginAccessIdentity({ client, context });
}

/**
 * Input parameters for hasExistingDistribution
 *
 * @internal
 */
interface IHasExistingDistributionInput {
  /** Pre-constructed CloudFront client */
  client: CloudFrontClient;
  /** Panfactum context for logging */
  context: PanfactumContext;
}

/**
 * Returns true if the AWS account has at least one CloudFront distribution
 *
 * @remarks
 * If the `ListDistributions` call fails for any reason (network, throttling,
 * permission issues), this helper debug-logs the failure and returns `false`
 * so that the caller falls through to the OAI probe.
 *
 * @internal
 * @param input - The CloudFront client and context
 * @returns True if at least one distribution exists, false otherwise
 */
async function hasExistingDistribution(
  input: IHasExistingDistributionInput
): Promise<boolean> {
  const { client, context } = input;

  try {
    const response = await client.send(
      new ListDistributionsCommand({ MaxItems: 1 })
    );
    const items = response.DistributionList?.Items ?? [];
    return items.length > 0;
  } catch (error) {
    context.logger.debug(
      `Unable to list CloudFront distributions; falling through to OAI probe: ${error instanceof Error ? error.message : JSON.stringify(error)}`
    );
    return false;
  }
}

/**
 * Input parameters for probeViaOriginAccessIdentity
 *
 * @internal
 */
interface IProbeViaOriginAccessIdentityInput {
  /** Pre-constructed CloudFront client */
  client: CloudFrontClient;
  /** Panfactum context for logging */
  context: PanfactumContext;
}

/**
 * Probes the CloudFront verification status by attempting to create (and
 * immediately delete) an Origin Access Identity
 *
 * @remarks
 * OAI creation is gated by the same account-verification check as
 * `CreateDistribution`, but is free, harmless, and fast. We use it instead
 * of probing with a real distribution because a successful distribution
 * create is billable and takes ~15 minutes to delete.
 *
 * The cleanup `try`/`finally` deliberately does NOT swallow any verification
 * error thrown by the create call — only a cleanup error is downgraded to a
 * warning so that the original error reaches the caller.
 *
 * @internal
 * @param input - The CloudFront client and context
 *
 * @throws {@link CLIError}
 * Throws when the verification check or the IAM permissions check fails.
 */
async function probeViaOriginAccessIdentity(
  input: IProbeViaOriginAccessIdentityInput
): Promise<void> {
  const { client, context } = input;

  const callerReference = `panfactum-preflight-${Date.now()}-${randomBytes(8).toString("hex")}`;

  let createdId: string | undefined;
  let createdETag: string | undefined;

  try {
    const createResponse = await client.send(
      new CreateCloudFrontOriginAccessIdentityCommand({
        CloudFrontOriginAccessIdentityConfig: {
          CallerReference: callerReference,
          Comment: "Panfactum pre-flight verification probe (safe to delete)",
        },
      })
    );

    createdId = createResponse.CloudFrontOriginAccessIdentity?.Id;
    createdETag = createResponse.ETag;

    context.logger.debug(
      `CloudFront pre-flight probe succeeded (OAI Id: ${createdId ?? "<unknown>"}); account is verified.`
    );
  } catch (error) {
    if (isVerificationError(error)) {
      throw new CLIError([
        "Your AWS account has not been verified for CloudFront resource creation.",
        "",
        "Panfactum's default cluster configuration deploys CloudFront distributions",
        "(via the kube_vault, kube_authentik, kube_grist, kube_nocodb, and",
        "kube_opensearch modules). Until your AWS account is verified, these",
        "deployments will fail.",
        "",
        "To resolve this:",
        "  1. Open https://console.aws.amazon.com/support/home#/case/create",
        "  2. Choose 'Service quota increase'",
        "  3. Select Service: CloudFront",
        "  4. Quota: 'Distributions per AWS account'",
        "  5. Request a new value of 1 (or higher)",
        "  6. Submit the case",
        "",
        "AWS typically resolves these requests within 1-2 business days. You will",
        "receive an email when verification is complete.",
        "",
        "After verification, re-run `pf cluster add` — it is idempotent and will",
        "resume from where it left off.",
      ]);
    }

    if (isAccessDenied(error)) {
      throw new CLIError([
        "The AWS principal used by this CLI lacks the required CloudFront permissions.",
        "",
        "Required actions:",
        "  - cloudfront:CreateCloudFrontOriginAccessIdentity",
        "  - cloudfront:DeleteCloudFrontOriginAccessIdentity",
        "  - cloudfront:ListDistributions",
        "",
        "The Panfactum bootstrap principal should have AdministratorAccess attached.",
        "Please verify the IAM policies attached to your AWS profile.",
      ]);
    }

    // Any other error (network, throttling, 5xx) — do not block the install.
    context.logger.debug(
      `CloudFront pre-flight probe failed with a non-actionable error; continuing: ${error instanceof Error ? error.message : JSON.stringify(error)}`
    );
    return;
  } finally {
    if (createdId) {
      try {
        await client.send(
          new DeleteCloudFrontOriginAccessIdentityCommand({
            Id: createdId,
            IfMatch: createdETag,
          })
        );
      } catch (cleanupError) {
        context.logger.warn(
          `Failed to clean up the CloudFront pre-flight probe Origin Access Identity ${createdId}. ` +
            `Please delete it manually via the AWS console or the CLI: ` +
            `aws cloudfront delete-cloud-front-origin-access-identity --id ${createdId}. ` +
            `Cause: ${cleanupError instanceof Error ? cleanupError.message : JSON.stringify(cleanupError)}`,
          { highlights: [createdId] }
        );
      }
    }
  }
}

/**
 * Returns true when the given error is the AWS CloudFront account-verification
 * error
 *
 * @remarks
 * `@aws-sdk/client-cloudfront` does not export a typed error class for this
 * condition, so this helper duck-types the error by inspecting `name`,
 * `$metadata.httpStatusCode`, and `message`.
 *
 * @internal
 * @param error - The error to classify
 * @returns True if the error indicates the account has not been verified
 */
function isVerificationError(error: unknown): boolean {
  if (!isAccessDenied(error)) {
    return false;
  }
  const message = (error as { message?: string }).message ?? "";
  return message.toLowerCase().includes("must be verified");
}

/**
 * Returns true when the given error is an HTTP 403 AccessDenied response
 *
 * @remarks
 * Used to distinguish IAM-permission failures from other errors. This helper
 * duck-types the error rather than relying on a typed error class because
 * `@aws-sdk/client-cloudfront` does not export one for this condition.
 *
 * @internal
 * @param error - The error to classify
 * @returns True if the error is a 403 AccessDenied response
 */
function isAccessDenied(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const httpStatus = candidate.$metadata?.httpStatusCode;
  const name = candidate.name;
  return (
    httpStatus === 403 &&
    (name === "AccessDenied" || name === "AccessDeniedException")
  );
}
