import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

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
