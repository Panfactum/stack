import type { Component } from "solid-js";

import { BooleanInput } from "@/components/solid/inputs/BooleanInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";
import StartupDiscountDescription from "@/pages/support/_components/solid/PriceCalculator/StartupDiscountDescription.tsx";

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
