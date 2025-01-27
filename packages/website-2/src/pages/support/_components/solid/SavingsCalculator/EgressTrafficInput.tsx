import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
