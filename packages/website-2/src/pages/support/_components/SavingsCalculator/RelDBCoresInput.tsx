import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
