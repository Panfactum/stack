import type { Component } from "solid-js";

import { BooleanInput } from "@/components/inputs/BooleanInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

const SupportCostsIncludedInput: Component = () => {
  return (
    <BooleanInput
      id={"support-costs-included-enabled"}
      label={"Include Labor Costs"}
      value={calculatorStore.supportCostsIncluded}
      onChange={(newVal) => {
        setCalculatorStore("supportCostsIncluded", newVal);
      }}
    />
  );
};

export default SupportCostsIncludedInput;
