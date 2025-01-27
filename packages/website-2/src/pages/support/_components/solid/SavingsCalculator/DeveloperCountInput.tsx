import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

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
