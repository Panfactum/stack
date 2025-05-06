import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/plus/pricing/_components/PricingSection/calculatorStore";

const RelDBMemoryInput: Component = () => {
  return (
    <IntegerInput
      id={"rel-db-memory"}
      label={"Memory GB"}
      value={calculatorStore.relDBMemory}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("relDBMemory", newVal);
      }}
    />
  );
};

export default RelDBMemoryInput;
