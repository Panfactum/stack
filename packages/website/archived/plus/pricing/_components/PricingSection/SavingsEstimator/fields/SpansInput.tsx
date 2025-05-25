import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

const SpansInput: Component = () => {
  return (
    <IntegerInput
      id={"spans"}
      label={"# of Tracing Spans / Month (Ms)"}
      value={calculatorStore.spans}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("spans", newVal);
      }}
    />
  );
};

export default SpansInput;
