import { clsx } from "clsx";
import { type Component, createEffect, type JSX } from "solid-js";

import { useBackgroundContext } from "@/components/context/background.ts";

import InputBase from "./InputBase.tsx";

interface BooleanInputProps {
  id: string;
  label: string;
  value: boolean;
  description?: string | Component;
  onChange?: (newVal: boolean) => void;
}

export const BooleanInput: Component<BooleanInputProps> = (props) => {
  const background = useBackgroundContext();

  let inputEl!: HTMLInputElement;

  const onInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
    if (props.onChange) {
      props.onChange(event.currentTarget.checked);
    }
  };

  const onClick: JSX.EventHandler<HTMLDivElement, MouseEvent> = () => {
    if (props.onChange && props.value !== inputEl.checked) {
      props.onChange(inputEl.checked);
    }
  };

  // This allows the input to be a "controlled input" (i.e., if props.value updates, the input field updates)
  createEffect(() => {
    inputEl.checked = props.value;
  });

  return (
    <InputBase
      label={props.label}
      id={props.id}
      description={props.description}
    >
      <div
        class="relative flex w-fit cursor-pointer items-center"
        on:click={onClick}
      >
        <input
          ref={(el) => (inputEl = el)}
          type="checkbox"
          id={props.id}
          class={clsx(
            "relative h-7 w-[3.25rem] !bg-none p-px",
            "transition-all duration-200 ease-in-out before:translate-x-0 checked:before:translate-x-full",
            "rounded-full text-transparent  hover:checked:bg-brand-500 focus:ring-0 focus:checked:bg-brand-500 disabled:opacity-50",
            "checked:border-brand-600 checked:bg-brand-500 checked:text-brand-500 disabled:pointer-events-none",
            "border-gray-warm-500 before:inline-block before:size-6 dark:checked:bg-brand-500",
            "before:rounded-full before:bg-gray-light-mode-400  before:shadow checked:before:bg-gray-light-mode-400",
            "before:ring-0 before:transition before:duration-200 before:ease-in-out dark:before:bg-white dark:checked:before:bg-white",
            background === "primary"
              ? "bg-transparent hover:bg-transparent"
              : "bg-primary hover:bg-primary",
          )}
          on:input={onInput}
        />
      </div>
    </InputBase>
  );
};
