import { CFP, NUMBER_FORMAT } from "@/lib/utils.ts";

import {
  EKS_PRICE,
  EXTRA_STACK_COST,
  LABOR_HOURS_PER_CLUSTER,
  LB_COST,
} from "../../priceConstants.ts";
import SavingsDescription from "../details/SavingsDescription.tsx";

export function calculateKubernetesSavings(
  clusterCount: number,
  laborHourlyCost: number,
) {
  const stackCost = clusterCount * (EKS_PRICE + LB_COST + EXTRA_STACK_COST);
  const baseCost = clusterCount * (EKS_PRICE + LB_COST);

  const hoursSaved = clusterCount * LABOR_HOURS_PER_CLUSTER;

  return {
    name: "Kubernetes",
    stackCost,
    stackCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(EKS_PRICE * clusterCount)} (${clusterCount} Clusters x ${CFP.format(EKS_PRICE)} EKS Cost)`,
          },
          {
            content: `${CFP.format(LB_COST * clusterCount)} (${clusterCount} Clusters x ${CFP.format(LB_COST)} AWS Load Balancer Cost)`,
            operation: "+",
          },
          {
            content: `${CFP.format(EXTRA_STACK_COST * clusterCount)} (${clusterCount} Clusters x ${CFP.format(EXTRA_STACK_COST)} Fixed Stack Cost / Cluster)`,
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
            content: `${CFP.format(EKS_PRICE * clusterCount)} (${clusterCount} Clusters x ${CFP.format(EKS_PRICE)} EKS Cost)`,
          },
          {
            content: `${CFP.format(LB_COST * clusterCount)} (${clusterCount} Clusters x ${CFP.format(LB_COST)} AWS Load Balancer Cost)`,
            operation: "+",
          },
          null,
          { content: `${CFP.format(baseCost)} Estimated Total Monthly Cost` },
        ]}
      />
    ),
    hoursSaved,
    laborSavings: hoursSaved * laborHourlyCost,
    laborSavingsDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${NUMBER_FORMAT.format(hoursSaved)} Hours Saved (${clusterCount} clusters x ${NUMBER_FORMAT.format(LABOR_HOURS_PER_CLUSTER)} hours saved / cluster)`,
          },
          {
            content: `${CFP.format(laborHourlyCost)} Developer Hourly Cost`,
            operation: "x",
          },
          null,
          {
            content: `${CFP.format(hoursSaved * laborHourlyCost)} Estimated Labor Savings`,
          },
        ]}
      />
    ),
    savings: baseCost - stackCost,
    savingsPercent: (baseCost - stackCost) / baseCost,
  };
}
