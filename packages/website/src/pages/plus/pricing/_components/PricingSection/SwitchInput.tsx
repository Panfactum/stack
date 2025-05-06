import { Switch } from "@kobalte/core/switch";
import { clsx } from "clsx";
import { type Component } from "solid-js";

export const SwitchInput: Component<{
  label: string;
  labelClass?: string;
  labelHidden?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = (props) => {
  return (
    <Switch
      class="inline-flex items-center gap-2"
      checked={props.checked}
      onChange={props.onChange}
    >
      <Switch.Input />
      <Switch.Control class="inline-flex h-6 w-12 items-center rounded-full bg-gray-light-mode-400 transition-all duration-200 ease-in-out data-[checked]:bg-brand-500 dark:bg-gray-dark-mode-100 dark:data-[checked]:bg-brand-300">
        <Switch.Thumb class="size-6 rounded-full bg-gray-dark-mode-200 ring-1 ring-inset ring-gray-dark-mode-400 transition-all duration-200 ease-in-out data-[checked]:translate-x-[calc(100%-1px)]" />
      </Switch.Control>
      <div class="flex items-center justify-between gap-4">
        <Switch.Label
          class={clsx(
            "text-sm",
            props.labelHidden && "sr-only",
            props.labelClass,
          )}
        >
          {props.label}
        </Switch.Label>
      </div>
    </Switch>
  );
};
