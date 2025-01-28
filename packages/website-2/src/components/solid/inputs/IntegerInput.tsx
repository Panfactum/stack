import { clsx } from "clsx";
import { type Component, createEffect, createSignal, type JSX } from "solid-js";

import { useBackgroundContext } from "@/components/solid/context/background.ts";

import InputBase from "./InputBase.tsx";

const NUMBER = /^[0-9]+$/;

interface IntegerInputProps {
  id: string;
  label: string;
  value: number;
  description?: string | Component;
  onChange?: (newVal: number) => void;
  max: number;
}

export const IntegerInput: Component<IntegerInputProps> = (props) => {
  const background = useBackgroundContext();

  let inputEl!: HTMLInputElement;

  const [lastVal, setLastVal] = createSignal<string>();
  const onInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
    const newValue = event.currentTarget.value;

    // Prevents non-integer inputs to form field
    if (NUMBER.test(newValue)) {
      const newNum = parseInt(newValue);
      if (newNum <= props.max) {
        setLastVal(newValue);
        if (props.onChange) {
          props.onChange(parseInt(newValue));
        }
        return;
      }
    } else if (newValue.length === 0) {
      setLastVal(newValue);
      if (props.onChange) {
        props.onChange(0);
      }
      return;
    }

    // If we have not returned by now, that means the input was invalid. As a result,
    // we reset the input to the previous value
    const selectionStart = event.currentTarget.selectionStart;
    event.currentTarget.value = lastVal() ?? "";

    // When the input contents are replaced, this can leave the user's cursor in a weird
    // location. This provides more sensible handling.
    // However, this is not perfect, as it will not preserve the user's mutli-character selection.
    // To do that, this handler would need to fire BEFORE the change has been entered into the DOM;
    // however, the logic for that is much more complicated so we will start here and expand as needed.
    if (selectionStart) {
      const newPosition = Math.max(0, selectionStart - 1);
      event.currentTarget.selectionStart = newPosition;
      event.currentTarget.selectionEnd = newPosition;
    }
  };

  // This allows the input to be a "controlled input" (i.e., if props.value updates, the input field updates)
  createEffect(() => {
    const newValue = `${props.value}`;
    const currentVal = inputEl.value;
    if (currentVal !== newValue && !(currentVal === "" && newValue === "0")) {
      inputEl.value = newValue;
      setLastVal(newValue);
    }
  });

  return (
    <InputBase
      label={props.label}
      description={props.description}
      id={props.id}
    >
      <input
        id={props.id}
        ref={(el) => (inputEl = el)}
        type="text"
        inputmode="numeric"
        max={`${props.max}`}
        class={clsx(
          "flex h-[46px] w-full rounded-md",
          "border border-gray-warm-300 focus:border-white dark:border-gray-dark-mode-700 dark:focus:border-gray-dark-mode-700",
          " px-[14px] py-[10px] shadow focus:ring-2 focus:ring-gray-warm-300 dark:focus:ring-gray-dark-mode-700",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          background === "primary" ? "bg-transparent" : "bg-primary",
        )}
        on:input={onInput}
      />
    </InputBase>
  );
};
