import type { Component } from "solid-js";

import { BooleanInput } from "@/components/inputs/BooleanInput.tsx";
import {NUMBER_FORMAT} from "@/lib/utils.ts";
import PrioritySupportEnabledDescription from "@/pages/_components/PriceCalculator/PrioritySupportEnabledDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";
import {PRIORITY_SUPPORT_MULTIPLIER} from "@/pages/_components/priceConstants.ts";

const PrioritySupportEnabledInput: Component = () => {
  return (
    <BooleanInput
      id={"priority-support"}
      label={`Priority Support (+${NUMBER_FORMAT.format(PRIORITY_SUPPORT_MULTIPLIER * 100)}%)`}
      description={PrioritySupportEnabledDescription}
      value={calculatorStore.prioritySupportEnabled}
      onChange={(newVal) => {
        setCalculatorStore("prioritySupportEnabled", newVal);
      }}
    />
  );
};

export default PrioritySupportEnabledInput;
