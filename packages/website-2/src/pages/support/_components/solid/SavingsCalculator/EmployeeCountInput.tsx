import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

const EmployeeCountInput: Component = () => {
  return (
    <IntegerInput
      id={"employee-count"}
      label={"# of Employees"}
      value={calculatorStore.employeeCount}
      max={10000000}
      onChange={(newVal) => {
        setCalculatorStore("employeeCount", newVal);
      }}
    />
  );
};

export default EmployeeCountInput;
