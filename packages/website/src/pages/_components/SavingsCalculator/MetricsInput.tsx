import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

const MetricsInput: Component = () => {
  return (
    <IntegerInput
      id={"logs"}
      label={"# of Metrics (Ks)"}
      value={calculatorStore.metrics}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("metrics", newVal);
      }}
    />
  );
};

export default MetricsInput;
