import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

const KVDBMemoryInput: Component = () => {
  return (
    <IntegerInput
      id={"kv-db-memory"}
      label={"Memory GB"}
      value={calculatorStore.kvDBMemory}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("kvDBMemory", newVal);
      }}
    />
  );
};

export default KVDBMemoryInput;
