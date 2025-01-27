import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
