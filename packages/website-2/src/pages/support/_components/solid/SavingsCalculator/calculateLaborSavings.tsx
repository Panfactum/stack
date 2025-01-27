import { CFP, NUMBER_FORMAT } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import { LABOR_COSTS_AS_PERCENT_OF_INFRA } from "../../priceConstants.ts";

export function calculateLaborSavings(
  infrastructureCosts: number,
  panfactumSupportCosts: number,
) {
  const stackCost = panfactumSupportCosts;
  const baseCost = infrastructureCosts * LABOR_COSTS_AS_PERCENT_OF_INFRA;

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
    baseCost,
    baseCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(baseCost)} (${CFP.format(infrastructureCosts)} x ${NUMBER_FORMAT.format(LABOR_COSTS_AS_PERCENT_OF_INFRA * 100)}% Estimated Labor Costs as Percent of Cloud Infra Spend (Gartner 2024))`,
          },
          null,
          {
            content: `${CFP.format(baseCost)} Estimated Total Monthly Labor Cost`,
          },
        ]}
      />
    ),
    savings: baseCost - stackCost,
    savingsPercent: (baseCost - stackCost) / baseCost,
  };
}
