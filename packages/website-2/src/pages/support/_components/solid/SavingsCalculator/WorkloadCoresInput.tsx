import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
