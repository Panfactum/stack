import type { Component } from "solid-js";

import { type CalculatorStoreSavingsComponents } from "@/pages/support/_components/calculatorStore.ts";

import { calculateAccessControlSavings } from "./calculateAccessControlSavings.tsx";
import { calculateCICDSavings } from "./calculateCICDSavings.tsx";
import { calculateDevProductivitySavings } from "./calculateDevProductivitySavings.tsx";
import { calculateKVDBSavings } from "./calculateKVDBSavings.tsx";
import { calculateKubernetesSavings } from "./calculateKubernetesSavings.tsx";
import { calculateLaborSavings } from "./calculateLaborSavings.tsx";
import { calculateNetworkSavings } from "./calculateNetworkSavings.tsx";
import { calculateObservabilitySavings } from "./calculateObservabilitySavings.tsx";
import { calculateRelationalDBSavings } from "./calculateRelationalDBSavings.tsx";
import { calculateWorkloadSavings } from "./calculateWorkloadSavings.tsx";


export interface SavingsLineItem {
  name: string;
  stackCost: number;
  stackCostDescription?: Component;
  baseCost: number;
  baseCostDescription?: Component;
  savings: number;
  savingsPercent: number;
}

export const calculateSavings: (
  inputs: CalculatorStoreSavingsComponents,
) => SavingsLineItem[] = (inputs) => {
  const {
    cicdMinutes,
    vpcCount,
    employeeCount,
    developerCount,
    spans,
    logs,
    metrics,
    egressTraffic,
    interAZTraffic,
    workloadMemory,
    workloadCores,
    utilization,
    relDBCores,
    relDBMemory,
    relDBStorage,
    productivityBoostEnabled,
    kvDBCores,
    kvDBMemory,
    kvDBStorage,
    supportCostsIncluded,
    supportPlanPrice,
    laborHourlyCost,
  } = inputs;

  const savingsItems: SavingsLineItem[] = [
    calculateCICDSavings(cicdMinutes),
    calculateKubernetesSavings(vpcCount),
    calculateAccessControlSavings(employeeCount, developerCount),
    calculateObservabilitySavings(spans, logs, metrics, vpcCount),
    calculateNetworkSavings(vpcCount, egressTraffic, interAZTraffic),
    calculateWorkloadSavings(workloadCores, workloadMemory, utilization),
    calculateRelationalDBSavings(
      relDBCores,
      relDBMemory,
      relDBStorage,
      utilization,
    ),
    calculateKVDBSavings(kvDBCores, kvDBMemory, kvDBStorage, utilization),
  ];

  if (supportCostsIncluded) {
    const baseInfraCosts = savingsItems.reduce(
      (acc, cur) => acc + cur.baseCost,
      0,
    );
    savingsItems.push(calculateLaborSavings(baseInfraCosts, supportPlanPrice));
  }

  if (productivityBoostEnabled) {
    savingsItems.push(
      calculateDevProductivitySavings(developerCount, laborHourlyCost),
    );
  }

  return savingsItems;
};
