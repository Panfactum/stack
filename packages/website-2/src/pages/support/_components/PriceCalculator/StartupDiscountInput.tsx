import type { Component } from "solid-js";

import { BooleanInput } from "@/components/inputs/BooleanInput.tsx";
import StartupDiscountDescription from "@/pages/support/_components/PriceCalculator/StartupDiscountDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

const StartupDiscountInput: Component = () => {
  return (
    <BooleanInput
      id={"startup-discount-enabled"}
      label={"Startup Discount"}
      description={StartupDiscountDescription}
      value={calculatorStore.startupDiscountEnabled}
      onChange={(newVal) => {
        setCalculatorStore("startupDiscountEnabled", newVal);
      }}
    />
  );
};

export default StartupDiscountInput;
