import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
