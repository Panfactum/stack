import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";
import WorkloadCountDescription from "@/pages/support/_components/solid/PriceCalculator/WorkloadCountDescription.tsx";

const WorkloadCountInput: Component = () => {
  return (
    <IntegerInput
      id={"workload-count"}
      label={"Number of Workloads / Cluster"}
      description={WorkloadCountDescription}
      value={calculatorStore.workloadCount}
      max={1000}
      onChange={(newVal) => {
        setCalculatorStore("workloadCount", newVal);
      }}
    />
  );
};

export default WorkloadCountInput;
