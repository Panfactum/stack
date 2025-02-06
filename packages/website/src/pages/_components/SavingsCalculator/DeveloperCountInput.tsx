import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

const DeveloperCountInput: Component = () => {
  return (
    <IntegerInput
      id={"developer-count"}
      label={"# of Developers"}
      value={calculatorStore.developerCount}
      max={10000000}
      onChange={(newVal) => {
        setCalculatorStore("developerCount", newVal);
      }}
    />
  );
};

export default DeveloperCountInput;
