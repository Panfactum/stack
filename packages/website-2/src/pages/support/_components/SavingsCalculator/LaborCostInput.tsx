import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
