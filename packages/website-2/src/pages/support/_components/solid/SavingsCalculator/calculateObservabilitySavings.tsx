import { CFP } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import {
  DATADOG_LOG_ARCHIVE_PER_GB,
  DATADOG_LOGS_INDEX_COST_PER_GB,
  DATADOG_LOGS_INGEST_COST_PER_GB,
  DATADOG_METRICS_COST_PER_1000,
  DATADOG_SPANS_INDEX_COST_PER_GB,
  DATADOG_SPANS_INGEST_COST_PER_GB,
  STACK_LOGS_COST_PER_GB,
  STACK_METRICS_COST_PER_1000,
  STACK_OBSERVABILITY_FIXED_COST_PER_CLUSTER,
  STACK_SPANS_COST_PER_GB,
} from "../../priceConstants.ts";

export function calculateObservabilitySavings(
  spans: number,
  logs: number,
  metrics: number,
  clusterCount: number,
) {
  const stackLogsCost = logs * STACK_LOGS_COST_PER_GB;
  const stackMetricsCost = metrics * STACK_METRICS_COST_PER_1000;
  const stackSpansCost = spans * STACK_SPANS_COST_PER_GB;
  const stackClusterCost =
    STACK_OBSERVABILITY_FIXED_COST_PER_CLUSTER * clusterCount;
  const stackCost =
    stackMetricsCost + stackLogsCost + stackSpansCost + stackClusterCost;

  const baseLogsCost =
    logs *
    (DATADOG_LOGS_INGEST_COST_PER_GB +
      DATADOG_LOGS_INDEX_COST_PER_GB +
      DATADOG_LOG_ARCHIVE_PER_GB);
  const baseMetricsCost = metrics * DATADOG_METRICS_COST_PER_1000;
  const baseSpansCost =
    spans *
    (DATADOG_SPANS_INDEX_COST_PER_GB + DATADOG_SPANS_INGEST_COST_PER_GB);
  const baseCost = baseLogsCost + baseMetricsCost + baseSpansCost;

  return {
    name: "Observability",
    stackCost,
    stackCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(stackLogsCost)} (${logs} GB Logs x ${CFP.format(STACK_LOGS_COST_PER_GB)} Amortized Cost per GB)`,
          },
          {
            content: `${CFP.format(stackMetricsCost)} (${metrics}K Metrics x ${CFP.format(STACK_METRICS_COST_PER_1000)} Amortized Cost per 1K Metrics)`,
            operation: "+",
          },
          {
            content: `${CFP.format(stackSpansCost)} (${spans}M Spans x ${CFP.format(STACK_SPANS_COST_PER_GB)} Amortized Cost per 1M Metrics)`,
            operation: "+",
          },
          {
            content: `${CFP.format(stackClusterCost)} (${clusterCount} Clusters x ${CFP.format(STACK_OBSERVABILITY_FIXED_COST_PER_CLUSTER)} Fixed Cost per Cluster)`,
            operation: "+",
          },
          null,
          { content: `${CFP.format(stackCost)} Estimated Total Monthly Cost` },
        ]}
      />
    ),
    baseCost,
    baseCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(baseLogsCost)} (${logs} GB Logs x (${CFP.format(DATADOG_LOGS_INGEST_COST_PER_GB)} per GB Ingested + ${CFP.format(DATADOG_LOGS_INDEX_COST_PER_GB)} per GB Indexed + ${CFP.format(DATADOG_LOG_ARCHIVE_PER_GB)} per GB Archived))`,
          },
          {
            content: `${CFP.format(baseMetricsCost)} (${metrics}K Metrics x ${CFP.format(DATADOG_METRICS_COST_PER_1000)} Cost per 1K Metrics)`,
            operation: "+",
          },
          {
            content: `${CFP.format(baseSpansCost)} (${spans}M Spans x (${CFP.format(DATADOG_SPANS_INGEST_COST_PER_GB)} per 1M Spans Ingested + ${CFP.format(DATADOG_SPANS_INDEX_COST_PER_GB)} per 1M Spans Indexed))`,
            operation: "+",
          },
          null,
          { content: `${CFP.format(baseCost)} Estimated Total Monthly Cost` },
        ]}
      />
    ),
    savings: baseCost - stackCost,
    savingsPercent: (baseCost - stackCost) / baseCost,
  };
}
