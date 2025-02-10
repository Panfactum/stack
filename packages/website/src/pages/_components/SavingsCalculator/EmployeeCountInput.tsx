import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";

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
