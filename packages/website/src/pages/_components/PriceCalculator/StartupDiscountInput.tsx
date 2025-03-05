import type { Component } from "solid-js";

import { BooleanInput } from "@/components/inputs/BooleanInput.tsx";
import { NUMBER_FORMAT } from "@/lib/utils.ts";
import StartupDiscountDescription from "@/pages/_components/PriceCalculator/StartupDiscountDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";
import { STARTUP_DISCOUNT_MULTIPLIER } from "@/pages/_components/priceConstants.ts";

const StartupDiscountInput: Component = () => {
  return (
    <BooleanInput
      id={"startup-discount-enabled"}
      label={`Startup Discount (${NUMBER_FORMAT.format(STARTUP_DISCOUNT_MULTIPLIER * 100)}%)`}
      description={StartupDiscountDescription}
      value={calculatorStore.startupDiscountEnabled}
      onChange={(newVal) => {
        setCalculatorStore("startupDiscountEnabled", newVal);
      }}
    />
  );
};

export default StartupDiscountInput;
