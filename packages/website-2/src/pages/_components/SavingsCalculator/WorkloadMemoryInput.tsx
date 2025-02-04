import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";

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
