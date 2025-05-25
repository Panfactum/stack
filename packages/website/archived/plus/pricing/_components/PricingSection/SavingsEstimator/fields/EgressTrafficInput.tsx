import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

const EgressTrafficInput: Component = () => {
  return (
    <IntegerInput
      id={"egress-traffic"}
      label={"Outbound Traffic GB / Month"}
      value={calculatorStore.egressTraffic}
      max={10000000}
      onChange={(newVal) => {
        setCalculatorStore("egressTraffic", newVal);
      }}
    />
  );
};

export default EgressTrafficInput;
