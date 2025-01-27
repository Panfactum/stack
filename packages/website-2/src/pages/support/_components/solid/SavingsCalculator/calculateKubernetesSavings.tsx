import { CFP } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import { EKS_PRICE, EXTRA_STACK_COST, LB_COST } from "../../priceConstants.ts";

export function calculateKubernetesSavings(clusterCount: number) {
  const stackCost = clusterCount * (EKS_PRICE + LB_COST + EXTRA_STACK_COST);
  const baseCost = clusterCount * (EKS_PRICE + LB_COST);

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
    savings: baseCost - stackCost,
    savingsPercent: (baseCost - stackCost) / baseCost,
  };
}
