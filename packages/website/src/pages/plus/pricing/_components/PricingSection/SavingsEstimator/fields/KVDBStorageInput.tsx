import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/plus/pricing/_components/PricingSection/calculatorStore";

const KVDBStorageInput: Component = () => {
  return (
    <IntegerInput
      id={"kv-db-storage"}
      label={"Storage GB"}
      value={calculatorStore.kvDBStorage}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("kvDBStorage", newVal);
      }}
    />
  );
};

export default KVDBStorageInput;
