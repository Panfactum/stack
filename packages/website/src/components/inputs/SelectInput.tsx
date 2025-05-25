import { clsx } from "clsx";
import {
  type Component,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  For,
} from "solid-js";
import { isServer } from "solid-js/web";

import { useBackgroundContext } from "@/components/context/background.ts";

import InputBase from "../../../archived/plus/pricing/_components/PricingSection/SavingsEstimator/inputs/InputBase.tsx";

type SelectInputOptions = Array<{ id: string; name: string }>;

interface SelectInputProps {
  id: string;
  label: string;
  options: SelectInputOptions;
  value: string;
  onChange?: (newValue: string) => void;
  description?: string | Component;
}

export const SelectInput: Component<SelectInputProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal<boolean>(false);
  const toggleIsOpen = () => setIsOpen((prev) => !prev);

  // Handles closing the dropdown when clicking outside the dropdown
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target;
    const selectElNode = selectEl();
    if (
      target instanceof Node &&
      selectElNode &&
      !selectElNode.contains(target)
    ) {
      setIsOpen(false);
    }
  };
  onMount(() => {
    if (!isServer) {
      window.document.addEventListener("mousedown", handleClickOutside);
    }
  });

  onCleanup(() => {
    if (!isServer) {
      window.document.removeEventListener("mousedown", handleClickOutside);
    }
  });

  const createOnSelect: (
    id: string,
    // eslint-disable-next-line solid/reactivity
  ) => JSX.EventHandler<HTMLDivElement, MouseEvent> = (id) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (props.onChange && props.value !== id) {
      props.onChange(id);
    }
    setIsOpen(false);
  };

  const selectedOption = () => {
    return (
      props.options.find(({ id }) => id === props.value)?.name ||
      "Please select an option"
    );
  };

  const [selectEl, setSelectEl] = createSignal<HTMLDivElement>();
  const background = useBackgroundContext();

  return (
    <InputBase
      label={props.label}
      id={props.id}
      description={props.description}
    >
      <div class="relative inline-block min-w-48" id={props.id}>
        {/* Dropdown button */}
        <button
          type="button"
          on:click={toggleIsOpen}
          class={clsx(
            "border-primary flex w-full items-center justify-between rounded-md border px-4 py-2 text-sm",
            "h-12 shadow focus:outline-none focus:ring-2",
            background === "primary" ? "bg-transparent" : "bg-primary",
          )}
        >
          {selectedOption()}
          <svg
            class="ml-2 size-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.54l3.71-3.31a.75.75 0 111.04 1.08l-4.24
               3.77a.75.75 0 01-1.04 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        {isOpen() && (
          <div
            ref={setSelectEl}
            class={clsx(
              "border-primary bg-primary absolute right-0 z-10 mt-2 w-56 origin-top-right cursor-pointer border",
              "rounded-md shadow-lg ring-1 ring-black",
            )}
          >
            <div class="py-1">
              <For each={props.options}>
                {({ id, name }) => (
                  <div
                    on:click={createOnSelect(id)}
                    class="block px-4 py-2 text-sm hover:font-semibold"
                  >
                    {name}
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </div>
    </InputBase>
  );
};
