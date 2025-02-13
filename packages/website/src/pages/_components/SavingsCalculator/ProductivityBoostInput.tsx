import type { Component } from "solid-js";

import { BooleanInput } from "@/components/inputs/BooleanInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

const ProductivityBoostInput: Component = () => {
  return (
    <BooleanInput
      id={"productivity-boost-enabled"}
      label={"Include Productivity Gains"}
      value={calculatorStore.productivityBoostEnabled}
      onChange={(newVal) => {
        setCalculatorStore("productivityBoostEnabled", newVal);
      }}
    />
  );
};

export default ProductivityBoostInput;
