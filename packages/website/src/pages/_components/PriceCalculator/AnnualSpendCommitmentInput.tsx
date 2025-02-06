import type { Component } from "solid-js";

import { BooleanInput } from "@/components/inputs/BooleanInput.tsx";
import {NUMBER_FORMAT} from "@/lib/utils.ts";
import AnnualSpendCommitmentDescription from "@/pages/_components/PriceCalculator/AnnualSpendCommitmentDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";
import {ANNUAL_SPEND_DISCOUNT_MULTIPLIER} from "@/pages/_components/priceConstants.ts";

const AnnualSpendCommitmentInput: Component = () => {
  return (
    <BooleanInput
      id={"annual-spend-commitment-enabled"}
      label={`Spend Commitment (${NUMBER_FORMAT.format(ANNUAL_SPEND_DISCOUNT_MULTIPLIER * 100)}%)`}
      description={AnnualSpendCommitmentDescription}
      value={calculatorStore.annualSpendCommitmentEnabled}
      onChange={(newVal) => {
        setCalculatorStore("annualSpendCommitmentEnabled", newVal);
      }}
    />
  );
};

export default AnnualSpendCommitmentInput;
