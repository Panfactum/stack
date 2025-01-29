import { CFP, NUMBER_FORMAT } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import { STACK_PRODUCTIVITY_BOOST } from "../priceConstants.ts";

export function calculateDevProductivitySavings(
  developerCount: number,
  hourlyLaborCosts: number,
) {
  const stackCost = 0;

  const baseLaborCosts = developerCount * hourlyLaborCosts * 160;
  const baseCost = baseLaborCosts * STACK_PRODUCTIVITY_BOOST;

  return {
    name: "Developer Productivity Savings",
    stackCost,
    baseCost,
    baseCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(baseLaborCosts)} (${NUMBER_FORMAT.format(developerCount)} developers x ${CFP.format(hourlyLaborCosts)} per hour x 160 hours per month`,
          },
          {
            content: `${NUMBER_FORMAT.format(STACK_PRODUCTIVITY_BOOST * 100)}% Productivity Gain from the Panfactum Framework`,
            operation: "x",
          },
          null,
          {
            content: `${CFP.format(baseCost)} Estimated Missed Productivity Boosts`,
          },
        ]}
      />
    ),
    savings: baseCost - stackCost,
    savingsPercent: (baseCost - stackCost) / baseCost,
  };
}
