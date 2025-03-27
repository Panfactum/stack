import { CFP, NUMBER_FORMAT } from "@/lib/utils.ts";

import {
  LABOR_HOURS_PER_DB_WORKLOAD,
  LABOR_HOURS_PER_STANDARD_MODULE,
} from "../../priceConstants.ts";
import SavingsDescription from "../details/SavingsDescription.tsx";

export function calculateModuleLaborSavings(
  clusterCount: number,
  moduleCount: number,
  laborHourlyCost: number,
) {
  const hoursSaved =
    clusterCount * LABOR_HOURS_PER_STANDARD_MODULE * moduleCount;
  return {
    name: "Prebuilt Module Labor",
    hoursSaved,
    laborSavings: hoursSaved * laborHourlyCost,
    laborSavingsDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${NUMBER_FORMAT.format(hoursSaved)} (${clusterCount} clusters x ${NUMBER_FORMAT.format(LABOR_HOURS_PER_DB_WORKLOAD)} hours saved / module x ${NUMBER_FORMAT.format(moduleCount)} prebuilt modules / cluster)`,
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
