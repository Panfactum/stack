import { CFP, NUMBER_FORMAT } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import {
  LABOR_COSTS_AS_PERCENT_OF_INFRA,
  LABOR_HOURS_PER_CLUSTER,
  LABOR_HOURS_PER_CUSTOM_WORKLOAD, LABOR_HOURS_PER_DB_WORKLOAD, LABOR_HOURS_PER_STANDARD_MODULE
} from "../priceConstants.ts";

export function calculateLaborSavings(
  infrastructureCosts: number,
  panfactumSupportCosts: number,
  laborHourlyCost: number,
  clusterCount: number,
  workloadCount: number,
  dbCount: number,
  moduleCount: number
) {
  const stackCost = panfactumSupportCosts;

  // Option 1: Calculate as a percent of total infrastructure spend (better for large companies)
  const baseCostOpt1 = infrastructureCosts * LABOR_COSTS_AS_PERCENT_OF_INFRA;

  // Option 2: Calculate as direct labor costs based on survey data
  const baseClusterCost = laborHourlyCost * clusterCount * LABOR_HOURS_PER_CLUSTER;
  const baseWorkloadCost = laborHourlyCost * clusterCount * workloadCount * LABOR_HOURS_PER_CUSTOM_WORKLOAD;
  const baseDBCost = laborHourlyCost * clusterCount * dbCount * LABOR_HOURS_PER_DB_WORKLOAD;
  const baseModuleCost = laborHourlyCost * clusterCount * moduleCount * LABOR_HOURS_PER_STANDARD_MODULE;
  const baseCostOpt2 = baseClusterCost + baseWorkloadCost + baseDBCost + baseModuleCost;

  const baseCost = Math.max(baseCostOpt1, baseCostOpt2)

  return {
    name: "Cloud Management Labor Costs",
    stackCost,
    stackCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(stackCost)} (Panfactum Support Plan Monthly Price)`,
          },
        ]}
      />
    ),
    baseCost: baseCost,
    baseCostDescription: () => (
      <SavingsDescription
        lineItems={
          baseCostOpt2 > baseCostOpt1 ?
          [
            {
              content: `${CFP.format(baseClusterCost)} (${CFP.format(laborHourlyCost)} hourly labor cost x ${NUMBER_FORMAT.format(LABOR_HOURS_PER_CLUSTER)} labor hours per cluster x ${NUMBER_FORMAT.format(clusterCount)} cluster(s)`,
            },
            {
              content: `${CFP.format(baseWorkloadCost)} (${CFP.format(laborHourlyCost)} hourly labor cost x ${NUMBER_FORMAT.format(LABOR_HOURS_PER_CUSTOM_WORKLOAD)} labor hours per custom workload x ${NUMBER_FORMAT.format(clusterCount * workloadCount)} workload deployments`, operation: "+"
            },
            {
              content: `${CFP.format(baseDBCost)} (${CFP.format(laborHourlyCost)} hourly labor cost x ${NUMBER_FORMAT.format(LABOR_HOURS_PER_DB_WORKLOAD)} labor hours per database x ${NUMBER_FORMAT.format(clusterCount * dbCount)} database deployment`, operation: "+"
            },
            {
              content: `${CFP.format(baseModuleCost)} (${CFP.format(laborHourlyCost)} hourly labor cost x ${NUMBER_FORMAT.format(LABOR_HOURS_PER_STANDARD_MODULE)} labor hours per Panfactum module x ${NUMBER_FORMAT.format(clusterCount * moduleCount)} module deployments`, operation: "+"
            },
            null,
            {
              content: `${CFP.format(baseCostOpt2)} Estimated Total Monthly Labor Cost`,
            },
          ] :
          [
            {
              content: `${CFP.format(baseCostOpt1)} (${CFP.format(infrastructureCosts)} x ${NUMBER_FORMAT.format(LABOR_COSTS_AS_PERCENT_OF_INFRA * 100)}% Estimated Labor Costs as Percent of Cloud Infra Spend (Gartner 2024))`,
            },
            null,
            {
              content: `${CFP.format(baseCostOpt1)} Estimated Total Monthly Labor Cost`,
            },
          ]
        }
      />
    ),
    savings: baseCost - stackCost,
    savingsPercent: (baseCost - stackCost) / baseCost,
  };
}
