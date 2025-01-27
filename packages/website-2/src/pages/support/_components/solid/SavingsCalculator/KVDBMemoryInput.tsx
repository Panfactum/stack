import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
