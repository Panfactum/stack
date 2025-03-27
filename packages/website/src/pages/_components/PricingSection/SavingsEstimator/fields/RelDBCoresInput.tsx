import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/PricingSection/calculatorStore";

const RelDBCoresInput: Component = () => {
  return (
    <IntegerInput
      id={"rel-db-cores"}
      label={"vCPU Cores"}
      value={calculatorStore.relDBCores}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("relDBCores", newVal);
      }}
    />
  );
};

export default RelDBCoresInput;
