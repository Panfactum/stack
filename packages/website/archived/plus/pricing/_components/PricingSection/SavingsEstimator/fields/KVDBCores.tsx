import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

const KVDBCoresInput: Component = () => {
  return (
    <IntegerInput
      id={"kv-db-cores"}
      label={"vCPU Cores"}
      value={calculatorStore.kvDBCores}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("kvDBCores", newVal);
      }}
    />
  );
};

export default KVDBCoresInput;
