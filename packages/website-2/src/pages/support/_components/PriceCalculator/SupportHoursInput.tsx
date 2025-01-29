import type { Component } from "solid-js";

import { SelectInput } from "@/components/inputs/SelectInput.tsx";
import { NUMBER_FORMAT } from "@/lib/utils.ts";
import SupportHoursDescription from "@/pages/support/_components/PriceCalculator/SupportHoursDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";
import { SUPPORT_HOURS_OPTIONS } from "@/pages/support/_components/priceConstants.ts";

const RENDERED_OPTIONS = SUPPORT_HOURS_OPTIONS.map((option) => ({
  ...option,
  name: `${option.name} (+${NUMBER_FORMAT.format(option.multiplier * 100)}%)`,
}));

const SupportHoursInput: Component = () => {
  return (
    <SelectInput
      id={"support-hours"}
      label={"Support Hours"}
      description={SupportHoursDescription}
      value={calculatorStore.supportHours}
      options={RENDERED_OPTIONS}
      onChange={(newVal) => {
        setCalculatorStore("supportHours", newVal);
      }}
    />
  );
};

export default SupportHoursInput;
