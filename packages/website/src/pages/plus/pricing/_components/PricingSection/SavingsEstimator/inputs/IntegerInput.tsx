import { NumberField } from "@kobalte/core/number-field";
import { clsx } from "clsx";
import { type Component } from "solid-js";

import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/plus/pricing/_components/PricingSection/calculatorStore";

interface IntegerInputProps {
  id: string;
  label: string;
  value: number;
  onChange?: (newVal: number) => void;
  max: number;
}

export const IntegerInput: Component<IntegerInputProps> = (props) => {
  return (
    <NumberField
      rawValue={
        props.value === 0 && calculatorStore.savingsCalculatorEdited
          ? undefined
          : props.value
      }
      onRawValueChange={(value) => {
        if (value !== props.value) {
          setCalculatorStore("savingsCalculatorEdited", true);
          props.onChange?.(value || 0);
        }
      }}
      maxValue={props.max}
      minValue={0}
      changeOnWheel={false}
      class="flex flex-col gap-1"
    >
      <NumberField.Label>{props.label}</NumberField.Label>
      <NumberField.Input
        class={clsx(
          "flex h-[46px] w-full rounded-md",
          "border border-gray-warm-300 focus:border-white dark:border-gray-dark-mode-700 dark:focus:border-gray-dark-mode-700",
          " px-[14px] py-[10px] shadow focus:ring-2 focus:ring-gray-warm-300 dark:focus:ring-gray-dark-mode-700",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "bg-gray-warm-100 text-black dark:bg-gray-dark-mode-300",
        )}
      />
    </NumberField>
  );
};
