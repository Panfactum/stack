import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

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
