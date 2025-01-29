import type { Component } from "solid-js";

import { BooleanInput } from "@/components/inputs/BooleanInput.tsx";
import AnnualSpendCommitmentDescription from "@/pages/support/_components/PriceCalculator/AnnualSpendCommitmentDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";

const AnnualSpendCommitmentInput: Component = () => {
  return (
    <BooleanInput
      id={"annual-spend-commitment-enabled"}
      label={"Annual Spend Commitment"}
      description={AnnualSpendCommitmentDescription}
      value={calculatorStore.annualSpendCommitmentEnabled}
      onChange={(newVal) => {
        setCalculatorStore("annualSpendCommitmentEnabled", newVal);
      }}
    />
  );
};

export default AnnualSpendCommitmentInput;
