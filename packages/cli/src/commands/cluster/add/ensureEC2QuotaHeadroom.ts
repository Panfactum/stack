// This file provides a utility function for checking and ensuring sufficient EC2 vCPU quota headroom
// It checks both On-Demand and Spot Standard vCPU quotas, automatically requesting increases when needed

import {
  GetMetricStatisticsCommand,
  type CloudWatchClient,
  type Statistic,
} from "@aws-sdk/client-cloudwatch";
import {
  GetServiceQuotaCommand,
  ListRequestedServiceQuotaChangeHistoryByQuotaCommand,
  RequestServiceQuotaIncreaseCommand,
  type ServiceQuotasClient,
} from "@aws-sdk/client-service-quotas";
import { getCloudWatchClient } from "@/util/aws/clients/getCloudWatchClient";
import { getServiceQuotasClient } from "@/util/aws/clients/getServiceQuotasClient";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

/** Minimum number of vCPU headroom required for SLA 1 clusters before requesting a quota increase */
const REQUIRED_VCPU_HEADROOM_SLA1 = 16;

/** Minimum number of vCPU headroom required for SLA 2/3 clusters before requesting a quota increase */
const REQUIRED_VCPU_HEADROOM_DEFAULT = 32;

/**
 * vCPUs consumed by the VPC module that can be subtracted from required headroom
 * when the VPC is already deployed, for SLA 2/3 clusters
 */
const VPC_VCPU_REDUCTION_DEFAULT = 6;

/**
 * vCPUs consumed by the VPC module that can be subtracted from required headroom
 * when the VPC is already deployed, for SLA 1 clusters (single-AZ, fewer NAT instances)
 */
const VPC_VCPU_REDUCTION_SLA1 = 2;

/**
 * vCPUs consumed by the EKS module (managed node group instances, etc.)
 * that can be subtracted from required headroom when EKS is already deployed
 */
const EKS_VCPU_REDUCTION = 6;

/** AWS service code for EC2 */
const EC2_SERVICE_CODE = "ec2";

/**
 * Configuration for an EC2 vCPU quota that should be checked
 */
interface IQuotaCheck {
  /** Service Quotas quota code (e.g. "L-1216C47A") */
  quotaCode: string;
  /** Human-readable label used in log messages (e.g. "EC2 On-Demand Standard vCPU") */
  label: string;
}

/** Quotas to check before installing an EKS cluster */
const QUOTA_CHECKS: ReadonlyArray<IQuotaCheck> = [
  {
    // Running On-Demand Standard (A, C, D, H, I, M, R, T, Z) instances
    quotaCode: "L-1216C47A",
    label: "EC2 On-Demand Standard vCPU",
  },
  {
    // All Standard (A, C, D, H, I, M, R, T, Z) Spot Instance Requests
    quotaCode: "L-34B43A08",
    label: "EC2 Spot Standard vCPU",
  },
];

/**
 * Input parameters for ensureEC2QuotaHeadroom
 */
export interface IEnsureEC2QuotaHeadroomInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name for authentication */
  profile: string;
  /** AWS region to check quotas in */
  region: string;
  /**
   * SLA target level for the cluster (1, 2, or 3).
   * SLA 1 requires only {@link REQUIRED_VCPU_HEADROOM_SLA1} vCPUs of headroom;
   * SLA 2/3 (or unknown) requires {@link REQUIRED_VCPU_HEADROOM_DEFAULT}.
   */
  slaTarget: number | undefined;
  /**
   * Whether the `aws_vpc` module has already been successfully deployed.
   * When true, {@link VPC_VCPU_REDUCTION_SLA1} or {@link VPC_VCPU_REDUCTION_DEFAULT} vCPUs
   * are subtracted from the required headroom (depending on SLA target) because those
   * instances are already running and reflected in current usage.
   */
  vpcAlreadyDeployed: boolean;
  /**
   * Whether the `aws_eks` module has already been successfully deployed.
   * When true, an additional {@link EKS_VCPU_REDUCTION} vCPUs are subtracted from the
   * required headroom because those instances are already running and reflected in current usage.
   */
  eksAlreadyDeployed: boolean;
}

/**
 * Checks EC2 vCPU quota headroom and automatically requests increases when insufficient
 *
 * @remarks
 * This function checks both the EC2 On-Demand Standard vCPU quota (`L-1216C47A`) and
 * the EC2 Spot Standard vCPU quota (`L-34B43A08`). For each quota, it compares the
 * current value against the usage reported by CloudWatch (via the `UsageMetric` field
 * returned by Service Quotas) and ensures sufficient vCPUs of headroom remain
 * (determined by {@link IEnsureEC2QuotaHeadroomInput.slaTarget} and {@link IEnsureEC2QuotaHeadroomInput.vpcAlreadyDeployed}).
 *
 * If headroom is insufficient for either quota, it checks for any pending quota
 * increase requests before submitting a new one.
 *
 * Behavior when headroom is insufficient:
 * - If a pending request already provides sufficient headroom: warns and continues
 * - If a pending request exists but won't provide sufficient headroom: warns and continues
 * - Otherwise: automatically requests a quota increase and warns the user
 *
 * Both quotas are checked independently — failing the check on one does not skip the other.
 *
 * @param input - Configuration including AWS profile, region, and Panfactum context
 * @returns Resolves when all checks are complete (either quota is sufficient or action has been taken)
 *
 * @example
 * ```typescript
 * await ensureEC2QuotaHeadroom({
 *   context,
 *   profile: 'production',
 *   region: 'us-east-1',
 *   slaTarget: 2,
 *   vpcAlreadyDeployed: true,
 * });
 * ```
 *
 * @throws {@link CLIError}
 * Throws when AWS API calls fail for quota retrieval or usage lookup
 *
 * @see {@link getServiceQuotasClient} - Service Quotas client factory
 * @see {@link getCloudWatchClient} - CloudWatch client factory
 */
export async function ensureEC2QuotaHeadroom(
  input: IEnsureEC2QuotaHeadroomInput
): Promise<void> {
  const { context, profile, region, slaTarget, vpcAlreadyDeployed, eksAlreadyDeployed } = input;

  const isSLA1 = slaTarget === 1;
  const baseHeadroom = isSLA1 ? REQUIRED_VCPU_HEADROOM_SLA1 : REQUIRED_VCPU_HEADROOM_DEFAULT;
  const vpcReduction = vpcAlreadyDeployed
    ? (isSLA1 ? VPC_VCPU_REDUCTION_SLA1 : VPC_VCPU_REDUCTION_DEFAULT)
    : 0;
  const eksReduction = eksAlreadyDeployed ? EKS_VCPU_REDUCTION : 0;
  const requiredVcpuHeadroom = baseHeadroom - vpcReduction - eksReduction;

  const serviceQuotasClient = await getServiceQuotasClient({
    context,
    profile,
    region,
  });
  const cloudWatchClient = await getCloudWatchClient({
    context,
    profile,
    region,
  });

  for (const check of QUOTA_CHECKS) {
    await ensureSingleQuotaHeadroom({
      context,
      serviceQuotasClient,
      cloudWatchClient,
      quotaCode: check.quotaCode,
      label: check.label,
      requiredVcpuHeadroom,
    });
  }
}

/**
 * Input parameters for ensureSingleQuotaHeadroom
 */
interface IEnsureSingleQuotaHeadroomInput {
  /** Panfactum context for logging */
  context: PanfactumContext;
  /** Pre-constructed Service Quotas client */
  serviceQuotasClient: ServiceQuotasClient;
  /** Pre-constructed CloudWatch client */
  cloudWatchClient: CloudWatchClient;
  /** Service Quotas quota code to check */
  quotaCode: string;
  /** Human-readable label used in log/warning messages */
  label: string;
  /** Minimum number of vCPUs of headroom required */
  requiredVcpuHeadroom: number;
}

/**
 * Checks headroom for a single quota and requests an increase if needed
 *
 * @internal
 * @param input - The clients, quota identifiers, and context
 *
 * @throws {@link CLIError}
 * Throws when the quota value cannot be retrieved from AWS
 */
async function ensureSingleQuotaHeadroom(
  input: IEnsureSingleQuotaHeadroomInput
): Promise<void> {
  const { context, serviceQuotasClient, cloudWatchClient, quotaCode, label, requiredVcpuHeadroom } =
    input;

  try {
    /***********************************************
     * Step 1: Get current quota value and usage metric info
     ***********************************************/
    let quotaValue: number;
    let usageMetric:
      | {
          metricNamespace: string;
          metricName: string;
          metricDimensions: Record<string, string>;
          metricStatisticRecommendation: string;
        }
      | undefined;

    try {
      const quotaResponse = await serviceQuotasClient.send(
        new GetServiceQuotaCommand({
          ServiceCode: EC2_SERVICE_CODE,
          QuotaCode: quotaCode,
        })
      );
      const value = quotaResponse.Quota?.Value;
      if (value === undefined) {
        throw new CLIError(
          `Unable to check ${label} quota: quota value was not returned by AWS`
        );
      }
      quotaValue = value;

      // Extract CloudWatch usage metric info if available
      const metric = quotaResponse.Quota?.UsageMetric;
      if (
        metric?.MetricNamespace &&
        metric.MetricName &&
        metric.MetricDimensions
      ) {
        usageMetric = {
          metricNamespace: metric.MetricNamespace,
          metricName: metric.MetricName,
          metricDimensions: metric.MetricDimensions,
          metricStatisticRecommendation:
            metric.MetricStatisticRecommendation ?? "Maximum",
        };
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(`Unable to check ${label} quota`, error);
    }

    /***********************************************
     * Step 2: Get current vCPU usage from CloudWatch
     ***********************************************/
    let currentVcpuUsage = 0;

    if (!usageMetric) {
      context.logger.debug(
        `Service Quotas did not return a UsageMetric for ${label} quota. Assuming 0 current usage.`
      );
    } else {
      try {
        // CloudWatch AWS/Usage metrics typically lag by ~10 minutes from real time,
        // so we query a 15-minute window to reliably capture the most recent datapoint.
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

        const metricsResponse = await cloudWatchClient.send(
          new GetMetricStatisticsCommand({
            Namespace: usageMetric.metricNamespace,
            MetricName: usageMetric.metricName,
            Dimensions: Object.entries(usageMetric.metricDimensions).map(
              ([name, value]) => ({ Name: name, Value: value })
            ),
            StartTime: fifteenMinutesAgo,
            EndTime: now,
            Period: 300,
            Statistics: [
              usageMetric.metricStatisticRecommendation as Statistic,
            ],
          })
        );

        // Get the most recent data point
        const datapoints = metricsResponse.Datapoints ?? [];
        if (datapoints.length > 0) {
          const sorted = datapoints.sort(
            (a, b) =>
              (b.Timestamp?.getTime() ?? 0) - (a.Timestamp?.getTime() ?? 0)
          );
          const latest = sorted[0];
          if (!latest) {
            throw new CLIError(`Unable to get CloudWatch usage metrics for ${label}: no datapoints found after sorting`);
          }
          currentVcpuUsage =
            latest.Maximum ?? latest.Average ?? latest.Sum ?? 0;
        }
      } catch (error) {
        context.logger.debug(
          `Unable to get CloudWatch usage metrics for ${label}, assuming 0 current usage: ${error instanceof Error ? error.message : JSON.stringify(error)}`
        );
      }
    }

    /***********************************************
     * Step 3: Calculate headroom
     ***********************************************/
    const headroom = quotaValue - currentVcpuUsage;
    context.logger.debug(
      `${label} quota: ${quotaValue}, usage: ${currentVcpuUsage}, headroom: ${headroom}`
    );

    /***********************************************
     * Step 4: Return early if headroom is sufficient
     ***********************************************/
    if (headroom >= requiredVcpuHeadroom) {
      return;
    }

    /***********************************************
     * Step 5: Handle insufficient headroom
     ***********************************************/
    context.logger.warn(
      `${label} quota headroom is insufficient (headroom: ${headroom}, required: ${requiredVcpuHeadroom}). Checking for pending quota increase requests...`
    );

    // Check for pending quota increase requests
    let pendingRequests: Array<{
      desiredValue: number;
      status: string;
    }> = [];

    try {
      const historyResponse = await serviceQuotasClient.send(
        new ListRequestedServiceQuotaChangeHistoryByQuotaCommand({
          ServiceCode: EC2_SERVICE_CODE,
          QuotaCode: quotaCode,
        })
      );

      pendingRequests = (historyResponse.RequestedQuotas ?? [])
        .filter(
          (req) => req.Status === "PENDING" || req.Status === "CASE_OPENED"
        )
        .map((req) => ({
          desiredValue: req.DesiredValue ?? 0,
          status: req.Status ?? "",
        }));
    } catch (error) {
      // Non-fatal: if we can't check pending requests, proceed to request
      context.logger.debug(
        `Unable to check pending ${label} quota requests: ${error instanceof Error ? error.message : JSON.stringify(error)}`
      );
    }

    if (pendingRequests.length > 0) {
      const sufficientRequest = pendingRequests.find(
        (req) => req.desiredValue - currentVcpuUsage >= requiredVcpuHeadroom
      );

      if (sufficientRequest) {
        context.logger.warn(
          `A ${label} quota increase to ${sufficientRequest.desiredValue} has already been requested and is ${sufficientRequest.status}. ` +
            `Once approved, there will be sufficient headroom to proceed. Please retry after the request is approved.`
        );
        return;
      }

      // Pending request exists but won't provide sufficient headroom
      const maxPendingValue = Math.max(
        ...pendingRequests.map((req) => req.desiredValue)
      );
      context.logger.warn(
        `A ${label} quota increase to ${maxPendingValue} is already pending, but it will not provide sufficient headroom ` +
          `(required headroom: ${requiredVcpuHeadroom}, current usage: ${currentVcpuUsage}). ` +
          `Please manually request a higher quota value via the AWS console: https://console.aws.amazon.com/servicequotas/home`
      );
      return;
    }

    // No pending request — submit a new quota increase request
    const desiredValue = currentVcpuUsage + requiredVcpuHeadroom;

    try {
      await serviceQuotasClient.send(
        new RequestServiceQuotaIncreaseCommand({
          ServiceCode: EC2_SERVICE_CODE,
          QuotaCode: quotaCode,
          DesiredValue: desiredValue,
        })
      );
      context.logger.warn(
        `${label} quota increase to ${desiredValue} has been requested. ` +
          `You will receive an email when the request is approved. ` +
          `Please retry cluster installation after the quota increase has been approved.`
      );
    } catch (error) {
      context.logger.warn(
        `Failed to automatically request a ${label} quota increase: ${error instanceof Error ? error.message : JSON.stringify(error)}. ` +
          `Please manually request a quota increase to at least ${desiredValue} vCPUs via the AWS console: https://console.aws.amazon.com/servicequotas/home`
      );
    }
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    throw new CLIError(
      `Unexpected error while checking ${label} quota headroom`,
      error
    );
  }
}
