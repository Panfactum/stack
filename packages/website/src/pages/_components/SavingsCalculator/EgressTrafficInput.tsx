import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

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
