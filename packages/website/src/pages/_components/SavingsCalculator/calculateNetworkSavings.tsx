import { CFP } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import {
  BASE_NAT_COST,
  BASE_NAT_COST_GB,
  INTER_AZ_COST_GB,
  OUTBOUND_COST_GB,
  STACK_NAT_COST,
} from "../priceConstants.ts";

export function calculateNetworkSavings(
  vpcCount: number,
  egressTraffic: number,
  interAZTraffic: number,
) {
  const stackNATCost = 3 * STACK_NAT_COST * vpcCount;
  const stackEgressCost = OUTBOUND_COST_GB * egressTraffic;
  const stackInterCost = INTER_AZ_COST_GB * interAZTraffic * 0.5;
  const stackCost = stackNATCost + stackEgressCost + stackInterCost;

  const baseNATCost = 3 * BASE_NAT_COST * vpcCount;
  const baseEgressCost = (OUTBOUND_COST_GB + BASE_NAT_COST_GB) * egressTraffic;
  const baseInterCost = INTER_AZ_COST_GB * interAZTraffic;
  const baseCost = baseNATCost + baseEgressCost + baseInterCost;

  return {
    name: "Networking",
    stackCost,
    stackCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(stackNATCost)} (3 x ${vpcCount} VPCs x ${CFP.format(STACK_NAT_COST)} NAT Instance Price)`,
          },
          {
            content: `${CFP.format(stackEgressCost)} (${egressTraffic} GB Outbound Traffic x ${CFP.format(OUTBOUND_COST_GB)} per GB)`,
            operation: "+",
          },
          {
            content: `${CFP.format(stackInterCost)} (${interAZTraffic} GB Inter-AZ Traffic x ${CFP.format(INTER_AZ_COST_GB)} per GB x 50% Reduction due to Locality-aware Routing)`,
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
            content: `${CFP.format(baseNATCost)} (3 x ${vpcCount} VPCs x ${CFP.format(BASE_NAT_COST)} NAT Instance Price)`,
          },
          {
            content: `${CFP.format(baseEgressCost)} (${egressTraffic} GB Outbound Traffic x ${CFP.format(OUTBOUND_COST_GB + BASE_NAT_COST_GB)} per GB)`,
            operation: "+",
          },
          {
            content: `${CFP.format(baseInterCost)} (${interAZTraffic} GB Inter-AZ Traffic x ${CFP.format(INTER_AZ_COST_GB)} per GB)`,
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
