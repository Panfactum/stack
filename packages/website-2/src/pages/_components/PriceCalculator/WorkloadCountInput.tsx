import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import WorkloadCountDescription from "@/pages/_components/PriceCalculator/WorkloadCountDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";

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
