import { CFP, CURRENCY_FORMAT_VERY_PRECISE } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import {
  GHA_CICD_COST_PER_CPU_MINUTE,
  STACK_WORKLOAD_CPU_PRICE,
  STACK_WORKLOAD_MEM_PRICE,
} from "../priceConstants.ts";

export function calculateCICDSavings(cicdMinutes: number) {
  const stackCostPerMinute =
    (STACK_WORKLOAD_CPU_PRICE + 2 * STACK_WORKLOAD_MEM_PRICE) / 30 / 24 / 60;
  const stackCost = cicdMinutes * stackCostPerMinute;
  const baseCost = cicdMinutes * GHA_CICD_COST_PER_CPU_MINUTE;
  const cicdHours = cicdMinutes / 60;

  return {
    name: "CI / CD",
    stackCost,
    stackCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(stackCost)} (${cicdHours} CPU-Hours x ${CURRENCY_FORMAT_VERY_PRECISE.format(stackCostPerMinute * 60)} CPU-Hour Spot Instance Cost)`,
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
            content: `${CFP.format(baseCost)} (${cicdHours} CPU-Hours x ${CURRENCY_FORMAT_VERY_PRECISE.format(GHA_CICD_COST_PER_CPU_MINUTE * 60)} CPU-Hour Cost)`,
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
