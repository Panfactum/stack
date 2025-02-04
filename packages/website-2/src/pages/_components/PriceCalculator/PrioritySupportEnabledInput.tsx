import type { Component } from "solid-js";

import { BooleanInput } from "@/components/inputs/BooleanInput.tsx";
import PrioritySupportEnabledDescription from "@/pages/_components/PriceCalculator/PrioritySupportEnabledDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";

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
