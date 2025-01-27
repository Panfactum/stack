import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
