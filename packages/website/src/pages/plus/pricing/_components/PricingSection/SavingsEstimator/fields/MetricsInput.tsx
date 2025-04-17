import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/plus/pricing/_components/PricingSection/calculatorStore";

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
