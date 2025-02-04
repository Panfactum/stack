import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";

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
