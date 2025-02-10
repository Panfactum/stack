import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

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
