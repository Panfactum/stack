import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/PricingSection/calculatorStore";

const LaborCostInput: Component = () => {
  return (
    <IntegerInput
      id={"labor-hourly-cost"}
      label={"Developer Cost (Hourly USD)"}
      value={calculatorStore.laborHourlyCost}
      max={10000000}
      onChange={(newVal) => {
        setCalculatorStore("laborHourlyCost", newVal);
      }}
    />
  );
};

export default LaborCostInput;
