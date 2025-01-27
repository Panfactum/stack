import { CFP } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import {
  OKTA_PRICING_PER_DEVELOPER,
  OKTA_PRICING_PER_EMPLOYEE,
  STACK_AC_PRICING_PER_EMPLOYEE,
  STACK_IDP_BASE_COST,
} from "../../priceConstants.ts";

export function calculateAccessControlSavings(
  employeeCount: number,
  developerCount: number,
) {
  const stackCostEmployees = employeeCount * STACK_AC_PRICING_PER_EMPLOYEE;
  const stackCost = STACK_IDP_BASE_COST + stackCostEmployees;

  const baseCostEmployees = employeeCount * OKTA_PRICING_PER_EMPLOYEE;
  const baseCostDevelopers = developerCount * OKTA_PRICING_PER_DEVELOPER;
  const baseCost = baseCostEmployees + baseCostDevelopers;

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
    savings: baseCost - stackCost,
    savingsPercent: (baseCost - stackCost) / baseCost,
  };
}
