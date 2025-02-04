import { type Component, onMount } from "solid-js";

import {
  type Background,
  BackgroundContext,
} from "@/components/context/background.ts";
import AnnualSpendCommitmentInput from "@/pages/_components/PriceCalculator/AnnualSpendCommitmentInput.tsx";
import ClusterCountInput from "@/pages/_components/PriceCalculator/ClusterCountInput.tsx";
import PriceSummary from "@/pages/_components/PriceCalculator/PriceSummary.tsx";
import PrioritySupportEnabledInput from "@/pages/_components/PriceCalculator/PrioritySupportEnabledInput.tsx";
import StartupDiscountInput from "@/pages/_components/PriceCalculator/StartupDiscountInput.tsx";
import SupportHoursInput from "@/pages/_components/PriceCalculator/SupportHoursInput.tsx";
import WorkloadCountInput from "@/pages/_components/PriceCalculator/WorkloadCountInput.tsx";
import { seedCalculator } from "@/pages/_components/calculatorStore.ts";

import InputRow from "../inputs/InputRow.tsx";

interface PriceCalculatorProps {
  background: Background;
}

const PriceCalculator: Component<PriceCalculatorProps> = (props) => {
  onMount(() => {
    seedCalculator();
  });

  return (
    // eslint-disable-next-line solid/reactivity
    <BackgroundContext.Provider value={props.background}>
      <div class="w-full">
        <InputRow title={"Footprint"}>
          <ClusterCountInput />
          <WorkloadCountInput />
        </InputRow>
        <InputRow title={"Support Modifiers"}>
          <PrioritySupportEnabledInput />
          <SupportHoursInput />
        </InputRow>
        <InputRow title={"Discounts"}>
          <StartupDiscountInput />
          <AnnualSpendCommitmentInput />
        </InputRow>
      </div>
      <PriceSummary />
    </BackgroundContext.Provider>
  );
};

export default PriceCalculator;
