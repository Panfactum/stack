import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/PricingSection/calculatorStore";

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
