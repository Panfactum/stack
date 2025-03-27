import { CFP, NUMBER_FORMAT } from "@/lib/utils.ts";

import {
  ACCESS_MANAGEMENT_HOURS_PER_DEVELOPER,
  ACCESS_MANAGEMENT_HOURS_PER_EMPLOYEE,
  OKTA_PRICING_PER_DEVELOPER,
  OKTA_PRICING_PER_EMPLOYEE,
  STACK_AC_PRICING_PER_EMPLOYEE,
  STACK_IDP_BASE_COST,
} from "../../priceConstants.ts";
import SavingsDescription from "../details/SavingsDescription.tsx";

export function calculateAccessControlSavings(
  employeeCount: number,
  developerCount: number,
  laborHourlyCost: number,
) {
  const stackCostEmployees = employeeCount * STACK_AC_PRICING_PER_EMPLOYEE;
  const stackCost = STACK_IDP_BASE_COST + stackCostEmployees;

  const baseCostEmployees = employeeCount * OKTA_PRICING_PER_EMPLOYEE;
  const baseCostDevelopers = developerCount * OKTA_PRICING_PER_DEVELOPER;
  const baseCost = baseCostEmployees + baseCostDevelopers;

  const hoursSavedEmployees =
    employeeCount * ACCESS_MANAGEMENT_HOURS_PER_EMPLOYEE;
  const hoursSavedDevelopers =
    developerCount * ACCESS_MANAGEMENT_HOURS_PER_DEVELOPER;
  const hoursSaved = hoursSavedEmployees + hoursSavedDevelopers;

  return {
    name: "Access Control",
    stackCost,
    stackCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(STACK_IDP_BASE_COST)} (Fixed cost for self-hosted IdP)`,
          },
          {
            content: `${CFP.format(stackCostEmployees)} (${employeeCount} employees x ${CFP.format(STACK_AC_PRICING_PER_EMPLOYEE)} Amortized Cost per Additional Employee)`,
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
            content: `${CFP.format(baseCostEmployees)} (${employeeCount} employees x ${CFP.format(OKTA_PRICING_PER_EMPLOYEE)} Okta Price per Employee)`,
          },
          {
            content: `${CFP.format(baseCostDevelopers)} (${developerCount} developers x ${CFP.format(OKTA_PRICING_PER_DEVELOPER)} Additional Cost for Developer Access Controls)`,
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
            content: `${NUMBER_FORMAT.format(hoursSavedEmployees)} hours (${employeeCount} employees x ${NUMBER_FORMAT.format(ACCESS_MANAGEMENT_HOURS_PER_EMPLOYEE)} hours saved with SSO per employee)`,
          },
          {
            content: `${NUMBER_FORMAT.format(hoursSavedDevelopers)} hours (${developerCount} developers x ${NUMBER_FORMAT.format(ACCESS_MANAGEMENT_HOURS_PER_DEVELOPER)} hours saved with SSO per developer)`,
            operation: "+",
          },
          null,
          { content: `${NUMBER_FORMAT.format(hoursSaved)} hours saved` },
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
