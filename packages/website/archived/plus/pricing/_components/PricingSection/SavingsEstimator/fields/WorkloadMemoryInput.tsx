import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

const WorkloadMemoryInput: Component = () => {
  return (
    <IntegerInput
      id={"workload-memory"}
      label={"Memory GB"}
      value={calculatorStore.workloadMemory}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("workloadMemory", newVal);
      }}
    />
  );
};

export default WorkloadMemoryInput;
