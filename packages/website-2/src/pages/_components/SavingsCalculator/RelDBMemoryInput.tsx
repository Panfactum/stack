import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";

const RelDBMemoryInput: Component = () => {
  return (
    <IntegerInput
      id={"rel-db-memory"}
      label={"Memory GB"}
      value={calculatorStore.relDBMemory}
      max={100000}
      onChange={(newVal) => {
        setCalculatorStore("relDBMemory", newVal);
      }}
    />
  );
};

export default RelDBMemoryInput;
