import { NumberField } from "@kobalte/core/number-field";
import { type Component } from "solid-js";

import { setCalculatorStore } from "./calculatorStore";

interface IntegerIncrementerProps {
  minValue?: number;
  value: number;
  onChange: (value: number) => void;
}

const IntegerIncrementer: Component<IntegerIncrementerProps> = (props) => {
  return (
    <NumberField
      style={{ "scrollbar-width": "none" }}
      class="flex h-8 max-w-fit overflow-hidden rounded-lg ring-2 ring-gray-light-mode-300 md:min-w-24 dark:ring-1 dark:ring-gray-dark-mode-600"
      rawValue={props.value || props.minValue || 0}
      minValue={props.minValue || 0}
      maxValue={999}
      changeOnWheel={false}
      onRawValueChange={(value) => {
        if (value !== props.value) {
          setCalculatorStore("clusterOptionsEdited", true);
          props.onChange(value);
        }
      }}
    >
      <NumberField.DecrementTrigger class="flex items-center justify-center border-r-2 border-gray-light-mode-300 bg-gray-light-mode-200 px-1.5 py-0.5 text-xl text-gray-dark-mode-600 md:px-2 md:py-1 dark:border-r dark:border-gray-dark-mode-600">
        &ndash;
      </NumberField.DecrementTrigger>
      <NumberField.Input class="w-8 border-none bg-gray-dark-mode-200 p-0 text-center text-sm text-black md:w-10" />
      <NumberField.IncrementTrigger class="flex items-center justify-center border-l-2 border-gray-light-mode-300 bg-gray-light-mode-200 px-1.5 py-0.5 text-xl text-gray-dark-mode-600 md:px-2 md:py-1 dark:border-l dark:border-gray-dark-mode-600">
        +
      </NumberField.IncrementTrigger>
    </NumberField>
  );
};

export default IntegerIncrementer;
