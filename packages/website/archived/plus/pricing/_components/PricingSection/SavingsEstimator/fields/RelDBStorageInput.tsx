import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

const RelDBStorageInput: Component = () => {
  return (
    <IntegerInput
      id={"rel-db-storage"}
      label={"Storage GB"}
      value={calculatorStore.relDBStorage}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("relDBStorage", newVal);
      }}
    />
  );
};

export default RelDBStorageInput;
