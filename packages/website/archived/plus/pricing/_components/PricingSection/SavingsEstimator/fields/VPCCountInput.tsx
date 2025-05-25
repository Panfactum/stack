import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

const VPCCountInput: Component = () => {
  return (
    <IntegerInput
      id={"vpc-count"}
      label={"# of VPCs"}
      value={calculatorStore.vpcCount}
      max={10000000}
      onChange={(newVal) => {
        setCalculatorStore("vpcCount", newVal);
      }}
    />
  );
};

export default VPCCountInput;
