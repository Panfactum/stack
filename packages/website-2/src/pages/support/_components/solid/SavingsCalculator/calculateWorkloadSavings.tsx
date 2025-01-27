import { CFP } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import {
  BASE_WORKLOAD_CPU_PRICE,
  BASE_WORKLOAD_MEM_PRICE,
  STACK_UTILIZATION_RATE,
  STACK_WORKLOAD_CPU_PRICE,
  STACK_WORKLOAD_MEM_PRICE,
} from "../../priceConstants.ts";

export function calculateWorkloadSavings(
  workloadCores: number,
  workloadMemory: number,
  utilization: number,
) {
  const stackCPUCost = workloadCores * STACK_WORKLOAD_CPU_PRICE;
  const stackMemoryCost = workloadMemory * STACK_WORKLOAD_MEM_PRICE;
  const stackRawCost = stackCPUCost + stackMemoryCost;
  const stackCost = stackRawCost / (STACK_UTILIZATION_RATE / 100);

  const baseCPUCost = workloadCores * BASE_WORKLOAD_CPU_PRICE;
  const baseMemoryCost = workloadMemory * BASE_WORKLOAD_MEM_PRICE;
  const baseRawCost = baseCPUCost + baseMemoryCost;
  const baseCost = baseRawCost / (utilization / 100);

  return {
    name: "Workloads",
    stackCost,
    stackCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(stackCPUCost)} (${workloadCores} CPU x ${CFP.format(STACK_WORKLOAD_CPU_PRICE)} arm64 Spot CPU Instance Price)`,
          },
          {
            content: `${CFP.format(stackMemoryCost)} (${workloadMemory} GB Memory x ${CFP.format(STACK_WORKLOAD_MEM_PRICE)} arm64 Spot Memory Instance Price)`,
            operation: "+",
          },
          null,
          { content: `${CFP.format(stackRawCost)} Raw Cost` },
          {
            content: `${STACK_UTILIZATION_RATE / 100} Optimized Utilization Rate`,
            operation: "÷",
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
            content: `${CFP.format(baseCPUCost)} (${workloadCores} CPU x ${CFP.format(BASE_WORKLOAD_CPU_PRICE)} amd64 On-Demand CPU Instance Price)`,
          },
          {
            content: `${CFP.format(baseMemoryCost)} (${workloadMemory} GB Memory x ${CFP.format(BASE_WORKLOAD_MEM_PRICE)} amd64 On-Demand Memory Instance Price)`,
            operation: "+",
          },
          null,
          { content: `${CFP.format(baseRawCost)} Raw Cost` },
          { content: `${utilization / 100} Utilization Rate`, operation: "÷" },
          null,
          { content: `${CFP.format(baseCost)} Estimated Total Monthly Cost` },
        ]}
      />
    ),
    savings: baseCost - stackCost,
    savingsPercent: (baseCost - stackCost) / baseCost,
  };
}
