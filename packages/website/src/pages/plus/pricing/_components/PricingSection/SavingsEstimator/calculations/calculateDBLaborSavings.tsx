import { CFP, NUMBER_FORMAT } from "@/lib/utils.ts";

import { LABOR_HOURS_PER_DB_WORKLOAD } from "../../priceConstants.ts";
import SavingsDescription from "../details/SavingsDescription.tsx";

export function calculateDBLaborSavings(
  clusterCount: number,
  dbCount: number,
  laborHourlyCost: number,
) {
  const hoursSaved = clusterCount * LABOR_HOURS_PER_DB_WORKLOAD * dbCount;
  return {
    name: "Database Labor",
    hoursSaved,
    laborSavings: hoursSaved * laborHourlyCost,
    laborSavingsDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${NUMBER_FORMAT.format(hoursSaved)} Hours Saved (${clusterCount} Clusters x ${NUMBER_FORMAT.format(LABOR_HOURS_PER_DB_WORKLOAD)} hours saved / database x ${NUMBER_FORMAT.format(dbCount)} databases / cluster)`,
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
