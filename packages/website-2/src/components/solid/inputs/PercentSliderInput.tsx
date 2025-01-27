import { type Component, createEffect, createSignal, type JSX } from "solid-js";
import "./IntegerSliderInput.css";

interface IntegerSliderInputProps {
  id: string;
  label: string;
  value: number;
  step?: number;
  minValue: number;
  maxValue: number;
  description?: string | Component;
  onChange?: (newVal: number) => void;
}

const PercentSliderInput: Component<IntegerSliderInputProps> = (
  props,
) => {
  const [inputEl, setInputEl] = createSignal<HTMLInputElement>();

  const onInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
    const newValue = event.currentTarget.value;
    const newNum = parseInt(newValue);
    if (props.onChange) {
      props.onChange(newNum);
    }
  };

  createEffect(() => {
    const newValue = `${props.value}`;
    const currentVal = inputEl()?.value;
    if (currentVal !== newValue) {
      const inputDOMEl = inputEl();
      if (inputDOMEl) {
        inputDOMEl.value = newValue;
      }
    }
  });

  return (
    <div class="col-span-full flex w-full gap-4">
      <label for={props.id} class="sr-only">
        {props.label}
      </label>
      <span class="w-10 font-semibold">{props.value}%</span>
      <div class={"flex w-full items-center gap-2"}>
        <span class="text-secondary text-sm">{props.minValue}%</span>
        <input
          ref={setInputEl}
          type="range"
          class={"integer-slider"}
          id={props.id}
          aria-orientation="horizontal"
          min={props.minValue}
          max={props.maxValue}
          step={props.step}
          on:input={onInput}
        />
        <span class="text-secondary text-sm">{props.maxValue}%</span>
      </div>
    </div>
  );
};

export default PercentSliderInput;
