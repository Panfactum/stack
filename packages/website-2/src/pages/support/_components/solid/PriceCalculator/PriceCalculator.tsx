import { type Component, onMount } from "solid-js";

import {
  type Background,
  BackgroundContext,
} from "@/components/solid/context/background.ts";
import { seedCalculator } from "@/pages/support/_components/calculatorStore.ts";
import AnnualSpendCommitmentInput from "@/pages/support/_components/solid/PriceCalculator/AnnualSpendCommitmentInput.tsx";
import ClusterCountInput from "@/pages/support/_components/solid/PriceCalculator/ClusterCountInput.tsx";
import PriceSummary from "@/pages/support/_components/solid/PriceCalculator/PriceSummary.tsx";
import PrioritySupportEnabledInput from "@/pages/support/_components/solid/PriceCalculator/PrioritySupportEnabledInput.tsx";
import StartupDiscountInput from "@/pages/support/_components/solid/PriceCalculator/StartupDiscountInput.tsx";
import SupportHoursInput from "@/pages/support/_components/solid/PriceCalculator/SupportHoursInput.tsx";
import WorkloadCountInput from "@/pages/support/_components/solid/PriceCalculator/WorkloadCountInput.tsx";

import InputRow from "../inputs/InputRow";

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
