import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/PricingSection/calculatorStore";

const WorkloadCoresInput: Component = () => {
  return (
    <IntegerInput
      id={"workload-cores"}
      label={"vCPU Cores"}
      value={calculatorStore.workloadCores}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("workloadCores", newVal);
      }}
    />
  );
};

export default WorkloadCoresInput;
