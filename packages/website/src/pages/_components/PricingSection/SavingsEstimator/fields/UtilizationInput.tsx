import type { Component } from "solid-js";

import PercentSliderInput from "@/pages/_components/PricingSection/SavingsEstimator/inputs/PercentSliderInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/PricingSection/calculatorStore";

const UtilizationInput: Component = () => {
  return (
    <PercentSliderInput
      id={"resource-utilization"}
      label={"Resource Utilization"}
      value={calculatorStore.utilization}
      maxValue={50}
      minValue={10}
      step={5}
      onChange={(newVal) => {
        setCalculatorStore("utilization", newVal);
      }}
    />
  );
};

export default UtilizationInput;
