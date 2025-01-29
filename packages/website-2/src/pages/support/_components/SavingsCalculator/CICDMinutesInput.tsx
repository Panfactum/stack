import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

const CICDMinutesInput: Component = () => {
  return (
    <IntegerInput
      id={"cicd-minutes"}
      label={"CPU-Minutes / Month"}
      value={calculatorStore.cicdMinutes}
      max={10000000}
      onChange={(newVal) => {
        setCalculatorStore("cicdMinutes", newVal);
      }}
    />
  );
};

export default CICDMinutesInput;
