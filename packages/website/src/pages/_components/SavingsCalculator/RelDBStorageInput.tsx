import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

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
