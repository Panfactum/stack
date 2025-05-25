import type { Component } from "solid-js";

import { IntegerInput } from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/IntegerInput";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

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
