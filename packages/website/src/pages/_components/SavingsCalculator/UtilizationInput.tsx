import type { Component } from "solid-js";

import PercentSliderInput from "@/components/inputs/PercentSliderInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

const UtilizationInput: Component = () => {
  return (
    <PercentSliderInput
      id={"resource-utilization"}
      label={"Resource Utilization"}
      value={calculatorStore.utilization}
      maxValue={65}
      minValue={15}
      step={5}
      onChange={(newVal) => {
        setCalculatorStore("utilization", newVal);
      }}
    />
  );
};

export default UtilizationInput;
