import type { Component } from "solid-js";

import { BooleanInput } from "@/components/solid/inputs/BooleanInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";
import PrioritySupportEnabledDescription from "@/pages/support/_components/solid/PriceCalculator/PrioritySupportEnabledDescription.tsx";

const PrioritySupportEnabledInput: Component = () => {
  return (
    <BooleanInput
      id={"priority-support"}
      label={"Priority Support"}
      description={PrioritySupportEnabledDescription}
      value={calculatorStore.prioritySupportEnabled}
      onChange={(newVal) => {
        setCalculatorStore("prioritySupportEnabled", newVal);
      }}
    />
  );
};

export default PrioritySupportEnabledInput;
