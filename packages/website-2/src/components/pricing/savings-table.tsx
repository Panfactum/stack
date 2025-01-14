import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent } from "@/components/ui/dialog.tsx";
import Tooltip from "@/components/ui/tooltip.tsx";
import {
  CURRENCY_FORMAT,
  CURRENCY_FORMAT_PRECISE,
  CURRENCY_FORMAT_VERY_PRECISE,
  NUMBER_FORMAT,
} from "@/lib/utils.ts";

// These are rough estimates taken by building a regression
// across various instance types in the M6A, C6A, and R6A instance classes
const BASE_WORKLOAD_CPU_PRICE = 21;
const BASE_WORKLOAD_MEM_PRICE = 3.5;

// Assumes a 70% discount for running spot instances which appears
// to be the average from the reference stack
const STACK_WORKLOAD_CPU_PRICE = BASE_WORKLOAD_CPU_PRICE * 0.3;
const STACK_WORKLOAD_MEM_PRICE = BASE_WORKLOAD_MEM_PRICE * 0.3;
const STACK_UTILIZATION_RATE = 66;

const S3_PRICE_GB = 0.023;
const EBS_PRICE_GB = 0.08;
const EBS_SNAPSHOT_PRICE_GB = 0.05;

// These are rough estimates taken by building a regression
// across various instance types in the db.r6i and db.m6i
const BASE_RDS_MEM_PRICE = 6.48;
const BASE_RDS_CPU_PRICE = 38.16;
const BASE_RDS_STORAGE_PRICE_GB = 0.115;
const BASE_RDS_BACKUP_STORAGE_PRICE_GB = 0.095;

// These are rough estimates taken by building a regression
// across various instance types in the cache.m7g.large and cache.r7g.large
const BASE_KV_MEM_PRICE = 6.57;
const BASE_KV_CPU_PRICE = 35.94;
const BASE_KV_BACKUP_STORAGE_PRICE_GB = 0.085;

// Networking costs
const STACK_NAT_COST = 3.066;
const BASE_NAT_COST = 32.4;
const BASE_NAT_COST_GB = 0.045;
const OUTBOUND_COST_GB = 0.09;
const INTER_AZ_COST_GB = 0.02;

// Observability costs
const DATADOG_METRICS_COST_PER_1000 = (4 * 1000) / 100;
const STACK_METRICS_COST_PER_1000 = 0.3;
const DATADOG_LOGS_INDEX_COST_PER_GB = 2.55; // Assuming average log size is 1KB
const DATADOG_LOGS_INGEST_COST_PER_GB = 0.1;
const DATADOG_LOG_ARCHIVE_PER_GB = 0.25;
const STACK_LOGS_COST_PER_GB =
  S3_PRICE_GB / 2 + EBS_PRICE_GB / 30 + DATADOG_LOGS_INGEST_COST_PER_GB; // we assume our ingest costs are the same as datadog
const DATADOG_SPANS_INDEX_COST_PER_GB = 2.55;
const DATADOG_SPANS_INGEST_COST_PER_GB = 0.1;
const STACK_SPANS_COST_PER_GB =
  S3_PRICE_GB / 2 + EBS_PRICE_GB / 30 + DATADOG_LOGS_INGEST_COST_PER_GB; // we assume our ingest costs are the same as datadog
const STACK_OBSERVABILITY_FIXED_COST_PER_CLUSTER = 40;

// Identity Provider costs
const OKTA_PRICING_PER_EMPLOYEE = 2 + 3 + 2 + 4 + 2 + 4 + 3 + 9; // Standard web ui access
const OKTA_PRICING_PER_DEVELOPER = 14 + 15; // Integrated access to databases and ssh servers
const STACK_AC_PRICING_PER_EMPLOYEE = 0.1;
const STACK_IDP_BASE_COST = 30;

// Kubernetes costs
const EKS_PRICE = 75;
const LB_COST = 25;
const EXTRA_STACK_COST = 75;

// CICD costs
const GHA_CICD_COST_PER_CPU_MINUTE = 0.008 / 2;

// Labor costs
const HOURS_TO_BUILD_STACK_EQUIVALENT_PER_CLUSTER = 500;
const HOURS_TO_MAINTAIN_STACK_EQUIVALENT_PER_CLUSTER = 25;
const STACK_PRODUCTIVITY_BOOST = 0.11;

interface CalcuateSavingsInput {
  workloadCores: number;
  workloadMemory: number;
  pgCores: number;
  pgMemory: number;
  pgStorage: number;
  kvCores: number;
  kvMemory: number;
  kvStorage: number;
  utilization: number;
  egressTraffic: number;
  vpcCount: number;
  interAZTraffic: number;
  logs: number;
  spans: number;
  metrics: number;
  employeeCount: number;
  developerCount: number;
  cicdMinutes: number;
  laborCostHourly: number;
}
function calculateSavings(input: CalcuateSavingsInput) {
  const {
    utilization,
    workloadMemory,
    workloadCores,
    pgMemory,
    pgCores,
    pgStorage,
    kvMemory,
    kvCores,
    kvStorage,
    egressTraffic,
    vpcCount,
    interAZTraffic,
    spans,
    logs,
    metrics,
    employeeCount,
    developerCount,
    cicdMinutes,
    laborCostHourly,
  } = input;

  const workloadStackCost =
    (workloadCores * STACK_WORKLOAD_CPU_PRICE +
      workloadMemory * STACK_WORKLOAD_MEM_PRICE) /
    (STACK_UTILIZATION_RATE / 100);
  const workloadBaseCost =
    (workloadCores * BASE_WORKLOAD_CPU_PRICE +
      workloadMemory * BASE_WORKLOAD_MEM_PRICE) /
    (utilization / 100);
  const relationalStackCost =
    (2 *
      (pgCores * STACK_WORKLOAD_CPU_PRICE +
        pgMemory * STACK_WORKLOAD_MEM_PRICE +
        pgStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB))) /
      (STACK_UTILIZATION_RATE / 100) +
    2 * S3_PRICE_GB * pgStorage;
  const relationalBaseCost =
    (2 *
      (pgCores * BASE_RDS_CPU_PRICE +
        pgMemory * BASE_RDS_MEM_PRICE +
        pgStorage *
          (BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB))) /
    (utilization / 100);
  const kvStackCost =
    (3 *
      (kvCores * STACK_WORKLOAD_CPU_PRICE +
        kvMemory * STACK_WORKLOAD_MEM_PRICE +
        kvStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB))) /
    (STACK_UTILIZATION_RATE / 100);
  const kvBaseCost =
    (2 *
      (kvCores * BASE_KV_CPU_PRICE +
        kvMemory * BASE_KV_MEM_PRICE +
        kvStorage * BASE_KV_BACKUP_STORAGE_PRICE_GB)) /
    (utilization / 100);
  const networkStackCost =
    3 * STACK_NAT_COST * vpcCount +
    OUTBOUND_COST_GB * egressTraffic +
    INTER_AZ_COST_GB * interAZTraffic * 0.5;
  const networkBaseCost =
    3 * BASE_NAT_COST * vpcCount +
    (OUTBOUND_COST_GB + BASE_NAT_COST_GB) * egressTraffic +
    INTER_AZ_COST_GB * interAZTraffic;
  const observabilityStackCost =
    spans * STACK_SPANS_COST_PER_GB +
    logs * STACK_LOGS_COST_PER_GB +
    metrics * STACK_METRICS_COST_PER_1000 +
    STACK_OBSERVABILITY_FIXED_COST_PER_CLUSTER * vpcCount;
  const observabilityBaseCost =
    spans *
      (DATADOG_SPANS_INDEX_COST_PER_GB + DATADOG_SPANS_INGEST_COST_PER_GB) +
    logs *
      (DATADOG_LOGS_INGEST_COST_PER_GB +
        DATADOG_LOGS_INDEX_COST_PER_GB +
        DATADOG_LOG_ARCHIVE_PER_GB) +
    metrics * DATADOG_METRICS_COST_PER_1000;
  const accessControlStackCost =
    STACK_IDP_BASE_COST + employeeCount * STACK_AC_PRICING_PER_EMPLOYEE;
  const accessControlBaseCost =
    employeeCount * OKTA_PRICING_PER_EMPLOYEE +
    developerCount * OKTA_PRICING_PER_DEVELOPER;
  const kubernetesStackCost =
    vpcCount * (EKS_PRICE + LB_COST + EXTRA_STACK_COST);
  const kubernetesBaseCost = vpcCount * (EKS_PRICE + LB_COST);
  const cicdStackCost =
    cicdMinutes *
    ((STACK_WORKLOAD_CPU_PRICE + 2 * STACK_WORKLOAD_MEM_PRICE) / 30 / 24 / 60);
  const cicdBaseCost = cicdMinutes * GHA_CICD_COST_PER_CPU_MINUTE;
  const setupCostSavings =
    HOURS_TO_BUILD_STACK_EQUIVALENT_PER_CLUSTER * vpcCount * laborCostHourly;
  const monthlyMaintenanceSavings =
    HOURS_TO_MAINTAIN_STACK_EQUIVALENT_PER_CLUSTER * vpcCount * laborCostHourly;
  const developerProductivityBoost =
    ((STACK_PRODUCTIVITY_BOOST * developerCount * 2000) / 12) * laborCostHourly;

  return {
    setup: {
      savings: setupCostSavings,
      savingsDescription: (
        <div className="flex flex-col w-fit">
          <div>
            {CURRENCY_FORMAT.format(laborCostHourly)} hourly rate x{" "}
            {NUMBER_FORMAT.format(HOURS_TO_BUILD_STACK_EQUIVALENT_PER_CLUSTER)}{" "}
            hours x {vpcCount} Clusters
          </div>
          <div className="italic">
            {NUMBER_FORMAT.format(HOURS_TO_BUILD_STACK_EQUIVALENT_PER_CLUSTER)}{" "}
            saved hours / cluster based on aggregated customer-reported data
          </div>
        </div>
      ),
    },
    monthlyMaintenance: {
      savings: monthlyMaintenanceSavings,
      savingsDescription: (
        <div className="flex flex-col w-fit">
          <div>
            {CURRENCY_FORMAT.format(laborCostHourly)} hourly rate x{" "}
            {NUMBER_FORMAT.format(
              HOURS_TO_MAINTAIN_STACK_EQUIVALENT_PER_CLUSTER,
            )}{" "}
            hours x {vpcCount} Clusters
          </div>
          <div className="italic">
            {NUMBER_FORMAT.format(
              HOURS_TO_MAINTAIN_STACK_EQUIVALENT_PER_CLUSTER,
            )}{" "}
            saved hours / cluster based on aggregated customer-reported data
          </div>
        </div>
      ),
    },
    productivityBoost: {
      savings: developerProductivityBoost,
      savingsDescription: (
        <div className="flex flex-col w-fit">
          <div>
            {CURRENCY_FORMAT.format(laborCostHourly)} hourly rate x{" "}
            {NUMBER_FORMAT.format(2000 / 12)} hours / month x{" "}
            {NUMBER_FORMAT.format(developerCount)} developers x{" "}
            {STACK_PRODUCTIVITY_BOOST * 100}% productivity improvement
          </div>
          <div className="italic">
            {STACK_PRODUCTIVITY_BOOST * 100}% productivity improvement based on
            aggregated customer-reported data
          </div>
        </div>
      ),
    },
    cicd: {
      stackCost: cicdStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              cicdMinutes *
                ((STACK_WORKLOAD_CPU_PRICE + 2 * STACK_WORKLOAD_MEM_PRICE) /
                  30 /
                  24 /
                  60),
            )}{" "}
            ({cicdMinutes / 60} CPU-Hours x{" "}
            {CURRENCY_FORMAT_VERY_PRECISE.format(
              (STACK_WORKLOAD_CPU_PRICE + 2 * STACK_WORKLOAD_MEM_PRICE) /
                30 /
                24,
            )}{" "}
            CPU-Hour Spot Instance Cost)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(cicdStackCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: cicdBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>Managed GitHub Actions Pricing</div>
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              cicdMinutes * GHA_CICD_COST_PER_CPU_MINUTE,
            )}{" "}
            ({cicdMinutes / 60} CPU-Hours x{" "}
            {CURRENCY_FORMAT_VERY_PRECISE.format(
              GHA_CICD_COST_PER_CPU_MINUTE * 60,
            )}{" "}
            CPU-Hour Cost)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(cicdBaseCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
    },
    kubernetes: {
      stackCost: kubernetesStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * vpcCount)}{" "}
            ({vpcCount} Clusters x {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE)}{" "}
            EKS Cost)
          </div>
          <div>
            + {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * LB_COST)} ({vpcCount}{" "}
            Clusters x {CURRENCY_FORMAT_PRECISE.format(LB_COST)} AWS Load
            Balancer Cost)
          </div>
          <div>
            + {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * EXTRA_STACK_COST)} (
            {vpcCount} Clusters x{" "}
            {CURRENCY_FORMAT_PRECISE.format(EXTRA_STACK_COST)} Fixed Stack Cost
            / Cluster)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(kubernetesStackCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: kubernetesBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * vpcCount)}{" "}
            ({vpcCount} Clusters x {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE)}{" "}
            EKS Cost)
          </div>
          <div>
            + {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * LB_COST)} ({vpcCount}{" "}
            Clusters x {CURRENCY_FORMAT_PRECISE.format(LB_COST)} AWS Load
            Balancer Cost)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(kubernetesBaseCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
    },
    accessControl: {
      stackCost: accessControlStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(STACK_IDP_BASE_COST)}{" "}
            (Fixed cost for self-hosted IdP)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              employeeCount * STACK_AC_PRICING_PER_EMPLOYEE,
            )}{" "}
            ({employeeCount} employees x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_AC_PRICING_PER_EMPLOYEE)}{" "}
            Amortized Cost per Additional Employee)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(accessControlStackCost)} Estimated
            Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: accessControlBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>Okta Pricing (for features comparable to the Stack)</div>
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              employeeCount * OKTA_PRICING_PER_EMPLOYEE,
            )}{" "}
            ({employeeCount} employees x{" "}
            {CURRENCY_FORMAT_PRECISE.format(OKTA_PRICING_PER_EMPLOYEE)} Okta
            Price per Employee)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              developerCount * OKTA_PRICING_PER_DEVELOPER,
            )}{" "}
            ({developerCount} developers x{" "}
            {CURRENCY_FORMAT_PRECISE.format(OKTA_PRICING_PER_DEVELOPER)}{" "}
            Additional Cost for Developer Access Controls)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(accessControlBaseCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
    },
    observability: {
      stackCost: observabilityStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(logs * STACK_LOGS_COST_PER_GB)} (
            {logs} GB Logs x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_LOGS_COST_PER_GB)} Amortized
            Cost per GB)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              metrics * STACK_METRICS_COST_PER_1000,
            )}{" "}
            ({metrics}K Metrics x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_METRICS_COST_PER_1000)}{" "}
            Amortized Cost per 1K Metrics)
          </div>
          <div>
            + {CURRENCY_FORMAT_PRECISE.format(spans * STACK_SPANS_COST_PER_GB)}{" "}
            ({spans}M Spans x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_SPANS_COST_PER_GB)} Amortized
            Cost per 1M Metrics)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              vpcCount * STACK_OBSERVABILITY_FIXED_COST_PER_CLUSTER,
            )}{" "}
            ({vpcCount} Clusters x{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              STACK_OBSERVABILITY_FIXED_COST_PER_CLUSTER,
            )}{" "}
            Fixed Cost per Cluster)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(observabilityStackCost)} Estimated
            Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: observabilityBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>Datadog Pricing (14-day Retention)</div>
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              logs *
                (DATADOG_LOGS_INGEST_COST_PER_GB +
                  DATADOG_LOGS_INDEX_COST_PER_GB +
                  DATADOG_LOG_ARCHIVE_PER_GB),
            )}{" "}
            ({logs} GB Logs x (
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_LOGS_INGEST_COST_PER_GB)}{" "}
            per GB Ingested +{" "}
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_LOGS_INDEX_COST_PER_GB)} per
            GB Indexed +{" "}
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_LOG_ARCHIVE_PER_GB)} per GB
            Archived))
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              metrics * DATADOG_METRICS_COST_PER_1000,
            )}{" "}
            ({metrics}K Metrics x{" "}
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_METRICS_COST_PER_1000)} Cost
            per 1K Metrics)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              spans *
                (DATADOG_SPANS_INDEX_COST_PER_GB +
                  DATADOG_SPANS_INGEST_COST_PER_GB),
            )}{" "}
            ({spans}M Spans x (
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_SPANS_INGEST_COST_PER_GB)}{" "}
            per 1M Spans Ingested +{" "}
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_SPANS_INDEX_COST_PER_GB)}{" "}
            per 1M Spans Indexed ))
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(observabilityBaseCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
    },
    network: {
      stackCost: networkStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(3 * STACK_NAT_COST * vpcCount)} (3 x{" "}
            {vpcCount} VPCs x {CURRENCY_FORMAT_PRECISE.format(STACK_NAT_COST)}{" "}
            NAT Instance Price)
          </div>
          <div>
            + {CURRENCY_FORMAT_PRECISE.format(OUTBOUND_COST_GB * egressTraffic)}{" "}
            ({egressTraffic} GB Outbound Traffic x{" "}
            {CURRENCY_FORMAT_PRECISE.format(OUTBOUND_COST_GB)} per GB)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              INTER_AZ_COST_GB * interAZTraffic * 0.5,
            )}{" "}
            ({interAZTraffic} GB Inter-AZ Traffic x{" "}
            {CURRENCY_FORMAT_PRECISE.format(INTER_AZ_COST_GB)} per GB x 50%
            Reduction due to Locality-aware Routing)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(networkStackCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: networkBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(3 * BASE_NAT_COST * vpcCount)} (3 x{" "}
            {vpcCount} VPCs x {CURRENCY_FORMAT_PRECISE.format(BASE_NAT_COST)}{" "}
            NAT Instance Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              (OUTBOUND_COST_GB + BASE_NAT_COST_GB) * egressTraffic,
            )}{" "}
            ({egressTraffic} GB Outbound Traffic x{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              OUTBOUND_COST_GB + BASE_NAT_COST_GB,
            )}{" "}
            per GB)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(INTER_AZ_COST_GB * interAZTraffic)}{" "}
            ({interAZTraffic} GB Inter-AZ Traffic x{" "}
            {CURRENCY_FORMAT_PRECISE.format(INTER_AZ_COST_GB)} per GB)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(networkBaseCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
    },
    workload: {
      stackCost: workloadStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              workloadCores * STACK_WORKLOAD_CPU_PRICE,
            )}{" "}
            ({workloadCores} CPU x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_CPU_PRICE)} Spot CPU
            Instance Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              workloadMemory * STACK_WORKLOAD_MEM_PRICE,
            )}{" "}
            ({workloadMemory} GB Memory x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_MEM_PRICE)} Spot
            Memory Instance Price)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              workloadCores * STACK_WORKLOAD_CPU_PRICE +
                workloadMemory * STACK_WORKLOAD_MEM_PRICE,
            )}{" "}
            Raw Price
          </div>
          <div>÷ {STACK_UTILIZATION_RATE / 100} Optimized Utilization Rate</div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(workloadStackCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: workloadBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              workloadCores * BASE_WORKLOAD_CPU_PRICE,
            )}{" "}
            ({workloadCores} CPU x{" "}
            {CURRENCY_FORMAT_PRECISE.format(BASE_WORKLOAD_CPU_PRICE)} On-Demand
            Instance CPU Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              workloadMemory * BASE_WORKLOAD_MEM_PRICE,
            )}{" "}
            ({workloadMemory} GB Memory x{" "}
            {CURRENCY_FORMAT_PRECISE.format(BASE_WORKLOAD_MEM_PRICE)} On-Demand
            Instance Memory Price)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              workloadCores * BASE_WORKLOAD_CPU_PRICE +
                workloadMemory * BASE_WORKLOAD_MEM_PRICE,
            )}{" "}
            Raw Price
          </div>
          <div>÷ {utilization / 100} Utilization Rate</div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(workloadBaseCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
    },
    relationalDB: {
      stackCost: relationalStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(pgCores * STACK_WORKLOAD_CPU_PRICE)}{" "}
            ({pgCores} CPU x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_CPU_PRICE)} Spot
            Instance CPU Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              pgMemory * STACK_WORKLOAD_MEM_PRICE,
            )}{" "}
            ({pgMemory} GB Memory x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_MEM_PRICE)} Spot
            Instance Memory Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              pgStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB),
            )}{" "}
            ({pgStorage} GB Disk x{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB,
            )}{" "}
            GP3 EBS Storage w/ Live Snapshot Price)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              pgCores * STACK_WORKLOAD_CPU_PRICE +
                pgMemory * STACK_WORKLOAD_MEM_PRICE +
                pgStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB),
            )}{" "}
            Raw Price
          </div>
          <div>x 2 (Hot Standby)</div>
          <div>÷ {STACK_UTILIZATION_RATE / 100} Optimized Utilization Rate</div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              (2 *
                (pgCores * STACK_WORKLOAD_CPU_PRICE +
                  pgMemory * STACK_WORKLOAD_MEM_PRICE +
                  pgStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB))) /
                (STACK_UTILIZATION_RATE / 100),
            )}{" "}
            Total Compute Cost
          </div>
          <div>
            + {CURRENCY_FORMAT_PRECISE.format(2 * S3_PRICE_GB * pgStorage)} (S3
            WAL Archives)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(relationalStackCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: relationalBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(pgCores * BASE_RDS_CPU_PRICE)} (
            {pgCores} CPU x {CURRENCY_FORMAT_PRECISE.format(BASE_RDS_CPU_PRICE)}{" "}
            RDS CPU Price)
          </div>
          <div>
            + {CURRENCY_FORMAT_PRECISE.format(pgMemory * BASE_RDS_MEM_PRICE)} (
            {pgMemory} GB Memory x{" "}
            {CURRENCY_FORMAT_PRECISE.format(BASE_RDS_MEM_PRICE)} RDS Memory
            Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              pgStorage *
                (BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB),
            )}{" "}
            ({pgStorage} GB Disk x{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB,
            )}{" "}
            GP3 RDS Storage w/ Live Snapshot Price)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              pgCores * BASE_RDS_CPU_PRICE +
                pgMemory * BASE_RDS_MEM_PRICE +
                pgStorage *
                  (BASE_RDS_STORAGE_PRICE_GB +
                    BASE_RDS_BACKUP_STORAGE_PRICE_GB),
            )}{" "}
            Raw Price
          </div>
          <div>x 2 (Hot Standby)</div>
          <div>÷ {utilization / 100} Utilization Rate</div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(relationalBaseCost)}{" "}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
    },
    kv: {
      stackCost: kvStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(kvCores * STACK_WORKLOAD_CPU_PRICE)}{" "}
            ({kvCores} CPU x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_CPU_PRICE)} Spot
            Instance CPU Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              kvMemory * STACK_WORKLOAD_MEM_PRICE,
            )}{" "}
            ({kvMemory} GB Memory x{" "}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_MEM_PRICE)} Spot
            Instance Memory Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              kvStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB),
            )}{" "}
            ({kvStorage} GB Disk x{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB,
            )}{" "}
            GP3 EBS Storage w/ Live Snapshot Price)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              kvCores * STACK_WORKLOAD_CPU_PRICE +
                kvMemory * STACK_WORKLOAD_MEM_PRICE +
                kvStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB),
            )}{" "}
            Raw Price
          </div>
          <div>x 3 (Hot Standby w/ Redis Sentinel)</div>
          <div>÷ {STACK_UTILIZATION_RATE / 100} Optimized Utilization Rate</div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(kvStackCost)} Estimated
            Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: kvBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(kvCores * BASE_KV_CPU_PRICE)} (
            {kvCores} CPU x {CURRENCY_FORMAT_PRECISE.format(BASE_KV_CPU_PRICE)}{" "}
            ElastiCache CPU Price)
          </div>
          <div>
            + {CURRENCY_FORMAT_PRECISE.format(kvMemory * BASE_KV_MEM_PRICE)} (
            {kvMemory} GB Memory x{" "}
            {CURRENCY_FORMAT_PRECISE.format(BASE_KV_MEM_PRICE)} ElastiCache
            Memory Price)
          </div>
          <div>
            +{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              kvStorage * BASE_KV_BACKUP_STORAGE_PRICE_GB,
            )}{" "}
            ({kvStorage} GB Disk x{" "}
            {CURRENCY_FORMAT_PRECISE.format(BASE_KV_BACKUP_STORAGE_PRICE_GB)}{" "}
            Backup Price per GB Price)
          </div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp;{" "}
            {CURRENCY_FORMAT_PRECISE.format(
              kvCores * BASE_KV_CPU_PRICE +
                kvMemory * BASE_KV_MEM_PRICE +
                kvStorage * BASE_KV_BACKUP_STORAGE_PRICE_GB,
            )}{" "}
            Raw Price
          </div>
          <div>x 2 (Hot Standby)</div>
          <div>÷ {utilization / 100} Utilization Rate</div>
          <hr className="bg-white h-0.5 w-full" />
          <div>
            &nbsp;&nbsp; {CURRENCY_FORMAT_PRECISE.format(kvBaseCost)} Estimated
            Total Monthly Cost
          </div>
        </div>
      ),
    },
    total: {
      stackCost:
        workloadStackCost +
        relationalStackCost +
        kvStackCost +
        networkStackCost +
        observabilityStackCost +
        accessControlStackCost +
        kubernetesStackCost +
        cicdStackCost,
      baseCost:
        workloadBaseCost +
        relationalBaseCost +
        kvBaseCost +
        networkBaseCost +
        observabilityBaseCost +
        accessControlBaseCost +
        kubernetesBaseCost +
        cicdBaseCost,
    },
  };
}

function SavingsTableColHeader({
  children,
  width = 150,
}: {
  children: ReactElement | string;
  width?: number;
}) {
  return (
    <th
      className={`bg-secondary border-b border-secondary text-xs text-secondary text-start py-lg px-3xl font-medium tracking-wide min-w-[${width}px] w-[${width}px]`}
    >
      {children}
    </th>
  );
}

function SavingsTableElementContainer({
  children,
  bold,
  brand,
}: {
  children: ReactElement | string;
  bold?: boolean;
  brand?: boolean;
}) {
  return (
    <td
      className={`py-xl px-3xl ${brand ? "bg-brand-primary dark:bg-brand-primary-darker" : ""}`}
    >
      <div
        className={`flex items-center justify-start whitespace-nowrap text-secondary ${bold ? "font-semibold" : ""}`}
      >
        {children}
      </div>
    </td>
  );
}

function SavingsTableElement({
  cost,
  description,
  brand,
}: {
  cost: number;
  description?: string | ReactElement;
  brand?: boolean;
}) {
  const rendered = CURRENCY_FORMAT.format(cost);
  return (
    <SavingsTableElementContainer brand={brand}>
      {description === undefined ? (
        rendered
      ) : (
        <Tooltip title={description}>
          <span className="underline decoration-dotted decoration-accent decoration-2 underline-offset-4">
            {rendered}
          </span>
        </Tooltip>
      )}
    </SavingsTableElementContainer>
  );
}

function CalculatedSavingsTableElement({
  baseCost,
  stackCost,
  description,
  brand,
}: {
  baseCost: number;
  stackCost: number;
  description?: string;
  brand?: boolean;
}) {
  const savingsPercent =
    (1 - Math.max(1, stackCost) / Math.max(1, baseCost)) * 100;
  const savingsDollar = baseCost - stackCost;

  const rendered = `${CURRENCY_FORMAT.format(Math.floor(savingsDollar + 0.5))} (${Math.floor(savingsPercent + 0.5)}%)`;
  return (
    <SavingsTableElementContainer bold={true} brand={brand}>
      {description === undefined ? (
        rendered
      ) : (
        <Tooltip title={description} position="right">
          <span className="underline decoration-dotted decoration-accent decoration-2 underline-offset-4">
            {rendered}
          </span>
        </Tooltip>
      )}
    </SavingsTableElementContainer>
  );
}

interface InfrastructureSavingsTableRowProps {
  bold?: boolean;
  header: string;
  headerDescription?: string | ReactElement;
  stackCost: number;
  stackCostDescription?: string | ReactElement;
  baseCost: number;
  baseCostDescription?: string | ReactElement;
  brand?: boolean;
}
function InfrastructureSavingsTableRow(
  props: InfrastructureSavingsTableRowProps,
) {
  const {
    header,
    headerDescription,
    stackCost,
    stackCostDescription,
    baseCost,
    baseCostDescription,
    bold = false,
    brand = false,
  } = props;

  return (
    <tr
      className={`m-0 ${brand ? "bg-brand-secondary dark:bg-brand-primary-darker" : "bg-primary"} border-b-[1px] border-r-[1px] border-solid border-secondary ${bold ? "font-semibold" : ""}`}
    >
      <th
        className={`${brand ? "bg-brand-secondary dark:bg-brand-primary-darker" : "bg-secondary"} text-secondary tracking-wide text-left px-4 whitespace-nowrap font-medium`}
      >
        {headerDescription === undefined ? (
          header
        ) : (
          <Tooltip title={headerDescription}>
            <span className="underline decoration-dotted decoration-white decoration-2 underline-offset-4 max-w-4xl w-full">
              {header}
            </span>
          </Tooltip>
        )}
      </th>
      <SavingsTableElement cost={baseCost} description={baseCostDescription} />
      <SavingsTableElement
        cost={stackCost}
        description={stackCostDescription}
      />
      <CalculatedSavingsTableElement
        baseCost={baseCost}
        stackCost={stackCost}
        brand={!brand}
      />
    </tr>
  );
}

interface LaborSavingsTableRowProps {
  bold?: boolean;
  header: string;
  headerDescription?: string | ReactElement;
  savings: number;
  savingsDescription?: string | ReactElement;
}
function LaborSavingsTableRow(props: LaborSavingsTableRowProps) {
  const {
    header,
    headerDescription,
    savings,
    savingsDescription,
    bold = false,
  } = props;

  return (
    <tr
      className={`m-0 bg-neutral border-b-[1px] border-r-[1px] border-solid border-secondary ${bold ? "font-semibold" : ""}`}
    >
      <th className="bg-primary text-secondary tracking-wide text-left px-4 leading-7 py-2 font-medium w-3/4">
        {headerDescription === undefined ? (
          header
        ) : (
          <Tooltip title={headerDescription} position={`right`}>
            <span className="underline decoration-dotted decoration-white decoration-2 underline-offset-4">
              {header}
            </span>
          </Tooltip>
        )}
      </th>
      <SavingsTableElement
        cost={savings}
        description={savingsDescription}
        brand={true}
      />
    </tr>
  );
}

export default function SavingsTable(
  props: CalcuateSavingsInput & { copyLinkToClipboard: () => void },
) {
  const { copyLinkToClipboard } = props;
  const [modalOpen, setModalOpen] = useState(false);
  const toggleModal = useCallback(() => {
    setModalOpen((val) => !val);
  }, [setModalOpen]);
  const savings = calculateSavings(props);

  return (
    <>
      <div
        className={`flex flex-col xl:flex-row xl:justify-between gap-y-4xl items-center`}
      >
        <div className={`flex flex-col items-start self-stretch gap-y-[12px]`}>
          <h3
            className="text-md text-brand-secondary font-semibold pt-4"
            onClick={toggleModal}
          >
            Infrastructure Cost Savings
          </h3>

          <div className="font-machina bg-gray-dark text-primary font-medium rounded text-display-md">
            {CURRENCY_FORMAT.format(
              savings.total.baseCost - savings.total.stackCost,
            )}{" "}
            / month
          </div>
          <Button variant={`outline`} size={`sm`} onClick={copyLinkToClipboard}>
            Share
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} size={`sm`} />
          </Button>
        </div>

        <p className="text-md xl:w-2/5 text-tertiary">
          These savings are based on comparable usage of popular managed
          services on AWS, Datadog, Okta, and GitHub actions that can be
          directly replaced by functionality included in the stack. These are
          course-grained <b>estimates</b>, and we can provide a more precise
          savings analysis if you{" "}
          <a
            href="/stack/pricing/contact"
            className="text-primary underline hover:cursor-pointer"
          >
            contact us.
          </a>
        </p>
      </div>

      <div className="flex-col hidden md:flex self-stretch">
        <table className="w-full border-collapse border border-secondary rounded-md table-fixed min-w-full lg:min-w-[990px]">
          <thead>
            <tr>
              <th
                colSpan="4"
                className={`py-2xl px-3xl text-lg font-semibold text-start border-b border-secondary`}
              >
                Infrastructure Cost Savings Details
              </th>
            </tr>
            <tr>
              <SavingsTableColHeader width={175}>
                <span>Category</span>
              </SavingsTableColHeader>
              <SavingsTableColHeader>
                <span>Managed Service Cost</span>
              </SavingsTableColHeader>
              <SavingsTableColHeader>
                <span>Panfactum Stack Cost</span>
              </SavingsTableColHeader>
              <SavingsTableColHeader>Monthly Savings</SavingsTableColHeader>
            </tr>
          </thead>
          <tbody>
            <InfrastructureSavingsTableRow
              header={"Access Control"}
              stackCost={savings.accessControl.stackCost}
              stackCostDescription={savings.accessControl.stackCostDescription}
              baseCost={savings.accessControl.baseCost}
              baseCostDescription={savings.accessControl.baseCostDescription}
            />
            <InfrastructureSavingsTableRow
              header={"Networking"}
              stackCost={savings.network.stackCost}
              stackCostDescription={savings.network.stackCostDescription}
              baseCost={savings.network.baseCost}
              baseCostDescription={savings.network.baseCostDescription}
            />
            <InfrastructureSavingsTableRow
              header={"Kubernetes Clusters"}
              stackCost={savings.kubernetes.stackCost}
              stackCostDescription={savings.kubernetes.stackCostDescription}
              baseCost={savings.kubernetes.baseCost}
              baseCostDescription={savings.kubernetes.baseCostDescription}
            />
            <InfrastructureSavingsTableRow
              header={"Stateless Workloads"}
              stackCost={savings.workload.stackCost}
              stackCostDescription={savings.workload.stackCostDescription}
              baseCost={savings.workload.baseCost}
              baseCostDescription={savings.workload.baseCostDescription}
            />
            <InfrastructureSavingsTableRow
              header={"Relational Databases"}
              stackCost={savings.relationalDB.stackCost}
              stackCostDescription={savings.relationalDB.stackCostDescription}
              baseCost={savings.relationalDB.baseCost}
              baseCostDescription={savings.relationalDB.baseCostDescription}
            />
            <InfrastructureSavingsTableRow
              header={"KV Databases"}
              stackCost={savings.kv.stackCost}
              stackCostDescription={savings.kv.stackCostDescription}
              baseCost={savings.kv.baseCost}
              baseCostDescription={savings.kv.baseCostDescription}
            />
            <InfrastructureSavingsTableRow
              header={"Observability"}
              stackCost={savings.observability.stackCost}
              stackCostDescription={savings.observability.stackCostDescription}
              baseCost={savings.observability.baseCost}
              baseCostDescription={savings.observability.baseCostDescription}
            />
            <InfrastructureSavingsTableRow
              header={"CICD"}
              stackCost={savings.cicd.stackCost}
              stackCostDescription={savings.cicd.stackCostDescription}
              baseCost={savings.cicd.baseCost}
              baseCostDescription={savings.cicd.baseCostDescription}
            />
            <InfrastructureSavingsTableRow
              bold={true}
              brand={true}
              header={"Total"}
              stackCost={savings.total.stackCost}
              baseCost={savings.total.baseCost}
            />
          </tbody>
        </table>
        <p className={`text-center mt-xl text-sm`}>
          Click <a onClick={toggleModal}>here</a> for additional assumptions
        </p>
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={toggleModal}
        onClose={toggleModal}
        aria-labelledby="savings-calculator-assumptions"
        aria-describedby="Show assumptions used in calculating the savings"
      >
        <DialogContent>
          <div className="content">
            <ul className="text-sm lg:text-base italic my-0 pl-4 flex flex-col gap-2">
              <li>Prices were last updated in Q2 2024.</li>
              <li>Every provisioned VPC will have an EKS cluster.</li>
              <li>
                The resource inputs should reflect &quot;actual&quot; usage, not
                provisioned resources. Additionally, they are a total across all
                environments / regions / clusters, not for an individual VPC.
              </li>
              <li>
                AWS base-case pricing uses{" "}
                <a
                  className="text-primary underline hover:cursor-pointer"
                  href={"https://aws.amazon.com/ec2/pricing/on-demand/"}
                >
                  On-Demand
                </a>{" "}
                rates for x86 instances.
              </li>
              <li>
                Per-CPU / Per-GB Memory Costs are derived from a regression
                analysis on AWS instance prices.
              </li>
              <li>
                Datadog prices are found on their{" "}
                <a
                  className="text-primary underline hover:cursor-pointer"
                  href={"https://www.datadoghq.com/pricing/list/"}
                >
                  price list.
                </a>
              </li>

              <li>
                The Okta pricing is based on stack-equivalent features
                purchased. For &quot;Privileged Access&quot; and &quot;Advanced
                Server Access,&quot; we conservatively estimate one server per
                developer. See their{" "}
                <a
                  className="text-primary underline hover:cursor-pointer"
                  href={"https://www.okta.com/pricing/"}
                >
                  price list.
                </a>
              </li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className={`flex flex-col xl:flex-row xl:justify-between gap-y-4xl items-center self-stretch`}
      >
        <div className={`flex flex-col items-start self-stretch gap-y-[12px]`}>
          <h3 className="text-md text-brand-secondary font-semibold pt-4">
            Labor Efficiency Gains
          </h3>

          <div>
            <h3 className="font-machina bg-gray-dark text-primary font-medium rounded text-display-md">
              {CURRENCY_FORMAT.format(
                savings.monthlyMaintenance.savings +
                  savings.productivityBoost.savings,
              )}{" "}
              / month
            </h3>
            <span
              className={`font-machina text-secondary text-display-xs font-medium`}
            >
              {CURRENCY_FORMAT.format(savings.setup.savings)} / one-time
            </span>
          </div>

          <Button variant={`outline`} size={`sm`} onClick={copyLinkToClipboard}>
            Share
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} size={`sm`} />
          </Button>
        </div>

        <p className="text-md xl:w-2/5 text-tertiary self-stretch lg:self-center">
          The Panfactum stack also significantly boosts your DevOps and
          developer productivity:
        </p>
      </div>

      <div className="hidden md:block self-stretch">
        <table className="w-full border-collapse border border-secondary rounded-md">
          <thead>
            <tr>
              <th
                colSpan="2"
                className={`py-2xl px-3xl text-lg font-semibold text-start border-b border-secondary`}
              >
                Labor Efficiency Gains Details
              </th>
            </tr>
            <tr>
              <SavingsTableColHeader>
                <span>Category</span>
              </SavingsTableColHeader>

              <SavingsTableColHeader>
                <span>Savings</span>
              </SavingsTableColHeader>
            </tr>
          </thead>
          <tbody>
            <LaborSavingsTableRow
              header={"Infrastructure Setup Savings (One-time)"}
              headerDescription={
                "Estimated labor costs for building Panfactum-equivalent infrastructure from scratch"
              }
              savings={savings.setup.savings}
              savingsDescription={savings.setup.savingsDescription}
            />
            <LaborSavingsTableRow
              header={"Infrastructure Maintenance Savings (Monthly)"}
              headerDescription={
                "Labor costs saved by offloading maintenance and upgrades to Panfactum infrastructure modules"
              }
              savings={savings.monthlyMaintenance.savings}
              savingsDescription={savings.monthlyMaintenance.savingsDescription}
            />
            <LaborSavingsTableRow
              header={"Developer Productivity Boost (Monthly)"}
              headerDescription={
                "Improvements to developer productivity attributable to enhancements provided by the Panfactum Stack"
              }
              savings={savings.productivityBoost.savings}
              savingsDescription={savings.productivityBoost.savingsDescription}
            />
          </tbody>
        </table>

        <p className="text-sm text-secondary mt-4 text-center">
          To learn more about how the Panfactum Stack improves developer
          productivity, see our{" "}
          <a
            href="/stack/features"
            className="text-primary underline hover:cursor-pointer"
          >
            features
          </a>{" "}
          and our{" "}
          <a
            href="/docs/framework/framework/overview"
            className="text-primary underline hover:cursor-pointer"
          >
            platform engineering framework.
          </a>
        </p>
      </div>
    </>
  );
}
