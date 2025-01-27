import { CFP } from "@/lib/utils.ts";

import SavingsDescription from "./SavingsDescription.tsx";
import {
  BASE_RDS_BACKUP_STORAGE_PRICE_GB,
  BASE_RDS_CPU_PRICE,
  BASE_RDS_MEM_PRICE,
  BASE_RDS_STORAGE_PRICE_GB,
  EBS_PRICE_GB,
  EBS_SNAPSHOT_PRICE_GB,
  S3_PRICE_GB,
  STACK_UTILIZATION_RATE,
  STACK_WORKLOAD_CPU_PRICE,
  STACK_WORKLOAD_MEM_PRICE,
} from "../../priceConstants.ts";

export function calculateRelationalDBSavings(
  cores: number,
  memory: number,
  storage: number,
  utilization: number,
) {
  const stackCPUCost = cores * STACK_WORKLOAD_CPU_PRICE;
  const stackMemoryCost = memory * STACK_WORKLOAD_MEM_PRICE;
  const stackStorageCost = storage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB);
  const stackRawCost = stackCPUCost + stackMemoryCost + stackStorageCost;
  const stackComputeCost = (2 * stackRawCost) / (STACK_UTILIZATION_RATE / 100);
  const stackS3Cost = 2 * S3_PRICE_GB * storage;
  const stackCost = stackComputeCost + stackS3Cost;

  const baseCPUCost = cores * BASE_RDS_CPU_PRICE;
  const baseMemoryCost = memory * BASE_RDS_MEM_PRICE;
  const baseStorageCost =
    storage * (BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB);
  const baseRawCost = baseCPUCost + baseMemoryCost + baseStorageCost;
  const baseCost = (2 * baseRawCost) / (utilization / 100);

  return {
    name: "Relational Databases",
    stackCost,
    stackCostDescription: () => (
      <SavingsDescription
        lineItems={[
          {
            content: `${CFP.format(stackCPUCost)} (${cores} CPU x ${CFP.format(STACK_WORKLOAD_CPU_PRICE)} arm64 Spot Instance CPU Price)`,
          },
          {
            content: `${CFP.format(stackMemoryCost)} (${memory} GB Memory x ${CFP.format(STACK_WORKLOAD_MEM_PRICE)} arm64 Spot Instance Memory Price)`,
            operation: "+",
          },
          {
            content: `${CFP.format(stackStorageCost)} (${storage} GB Disk x ${CFP.format(EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB)} GP3 EBS Storage w/ Live Snapshot Price)`,
            operation: "+",
          },
          null,
          { content: `${CFP.format(stackRawCost)} Raw Cost` },
          { content: `2 (Hot Standby)`, operation: "x" },
          {
            content: `${STACK_UTILIZATION_RATE / 100} Optimized Utilization Rate`,
            operation: "÷",
          },
          null,
          { content: `${CFP.format(stackComputeCost)} Total Compute Cost` },
          {
            content: `${CFP.format(stackS3Cost)} (S3 WAL Archives)`,
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
            content: `${CFP.format(baseCPUCost)} (${cores} CPU x ${CFP.format(BASE_RDS_CPU_PRICE)} RDS CPU Price)`,
          },
          {
            content: `${CFP.format(baseMemoryCost)} (${memory} GB Memory x ${CFP.format(BASE_RDS_MEM_PRICE)} RDS Memory Price)`,
            operation: "+",
          },
          {
            content: `${CFP.format(baseStorageCost)} (${storage} GB Disk x ${CFP.format(BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB)} GP3 RDS Storage w/ Live Snapshot Price)`,
            operation: "+",
          },
          null,
          { content: `${CFP.format(baseRawCost)} Raw Cost` },
          { content: `2 (Hot Standby)`, operation: "x" },
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
