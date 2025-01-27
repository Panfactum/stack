import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
