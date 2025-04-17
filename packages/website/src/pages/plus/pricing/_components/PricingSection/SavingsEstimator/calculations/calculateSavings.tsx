import type { Component } from "solid-js";

import { type CalculatorStoreSavingsComponents } from "@/pages/plus/pricing/_components/PricingSection/calculatorStore.tsx";

import { calculateAccessControlSavings } from "./calculateAccessControlSavings.tsx";
import { calculateCICDSavings } from "./calculateCICDSavings.tsx";
import { calculateCustomWorkloadLaborSavings } from "./calculateCustomWorkloadSavings.tsx";
import { calculateDBLaborSavings } from "./calculateDBLaborSavings.tsx";
import { calculateKVDBSavings } from "./calculateKVDBSavings.tsx";
import { calculateKubernetesSavings } from "./calculateKubernetesSavings.tsx";
import { calculateModuleLaborSavings } from "./calculateModuleLaborSavings.tsx";
import { calculateNetworkSavings } from "./calculateNetworkSavings.tsx";
import { calculateObservabilitySavings } from "./calculateObservabilitySavings.tsx";
import { calculateRelationalDBSavings } from "./calculateRelationalDBSavings.tsx";
import { calculateWorkloadSavings } from "./calculateWorkloadSavings.tsx";

export interface SavingsLineItem {
  name: string;
  stackCost?: number;
  stackCostDescription?: Component;
  baseCost?: number;
  baseCostDescription?: Component;
  savings?: number;
  savingsPercent?: number;
  laborSavings?: number;
  hoursSaved?: number;
  laborSavingsDescription?: Component;
}

export const calculateSavings: (
  inputs: CalculatorStoreSavingsComponents,
) => SavingsLineItem[] = (inputs) => {
  const {
    plan,
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
    kvDBCores,
    kvDBMemory,
    kvDBStorage,
    clusterCount,
    workloadCount,
    dbCount,
    moduleCount,
    laborHourlyCost,
  } = inputs;

  const adjustedClusterCount = plan !== 1 ? clusterCount : 2;

  const savingsItems: SavingsLineItem[] = [
    calculateWorkloadSavings(workloadCores, workloadMemory, utilization),
    calculateRelationalDBSavings(
      relDBCores,
      relDBMemory,
      relDBStorage,
      utilization,
    ),
    calculateKVDBSavings(kvDBCores, kvDBMemory, kvDBStorage, utilization),
    calculateKubernetesSavings(adjustedClusterCount, laborHourlyCost),
    calculateCustomWorkloadLaborSavings(
      adjustedClusterCount,
      plan !== 1 ? workloadCount : 1,
      laborHourlyCost,
    ),
    calculateDBLaborSavings(
      adjustedClusterCount,
      plan !== 1 ? dbCount : 0,
      laborHourlyCost,
    ),
    calculateModuleLaborSavings(
      adjustedClusterCount,
      plan !== 1 ? moduleCount : 1,
      laborHourlyCost,
    ),
    calculateNetworkSavings(vpcCount, egressTraffic, interAZTraffic),
    calculateAccessControlSavings(
      employeeCount,
      developerCount,
      laborHourlyCost,
    ),
    calculateObservabilitySavings(spans, logs, metrics, adjustedClusterCount),
    calculateCICDSavings(cicdMinutes),
  ];

  return savingsItems;
};
