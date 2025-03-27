import { CFP, NUMBER_FORMAT } from "@/lib/utils.ts";

import { LABOR_HOURS_PER_CUSTOM_WORKLOAD } from "../../priceConstants.ts";
import SavingsDescription from "../details/SavingsDescription.tsx";

export function calculateCustomWorkloadLaborSavings(
  clusterCount: number,
  workloadCount: number,
  laborHourlyCost: number,
) {
  const hoursSaved =
    clusterCount * LABOR_HOURS_PER_CUSTOM_WORKLOAD * workloadCount;
  return {
    name: "Custom Workload Labor",
    hoursSaved,
    laborSavings: hoursSaved * laborHourlyCost,
    laborSavingsDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${NUMBER_FORMAT.format(hoursSaved)} Hours Saved (${clusterCount} clusters x ${NUMBER_FORMAT.format(LABOR_HOURS_PER_CUSTOM_WORKLOAD)} hours saved / workload x ${NUMBER_FORMAT.format(workloadCount)} custom workloads / cluster)`,
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
  };
}
