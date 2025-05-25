import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

const InterAZTrafficInput: Component = () => {
  return (
    <IntegerInput
      id={"inter-az-traffic"}
      label={"Inter-AZ Traffic GB / Month"}
      value={calculatorStore.interAZTraffic}
      max={10000000}
      onChange={(newVal) => {
        setCalculatorStore("interAZTraffic", newVal);
      }}
    />
  );
};

export default InterAZTrafficInput;
