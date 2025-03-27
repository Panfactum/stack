import { Select } from "@kobalte/core/select";
import { createSignal, type Component } from "solid-js";

import Modal from "@/components/ui/Modal";
import { NUMBER_FORMAT } from "@/lib/utils.ts";
import InfoIcon from "@/pages/_components/PricingSection/SavingsEstimator/InfoIcon";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/PricingSection/calculatorStore";
import { SUPPORT_HOURS_OPTIONS } from "@/pages/_components/PricingSection/priceConstants";

import SupportHoursDescription from "./SupportHoursDescription";

const RENDERED_OPTIONS = SUPPORT_HOURS_OPTIONS.map((option) => ({
  ...option,
  name: `${option.description} (+${NUMBER_FORMAT.format(option.multiplier * 100)}%)`,
}));

const SupportHoursInput: Component = () => {
  const [open, setOpen] = createSignal(false);
  const toggleOpen = () => setOpen((prev) => !prev);
  return (
    <div class="z-20 flex gap-4">
      <Select<(typeof RENDERED_OPTIONS)[number]>
        value={
          RENDERED_OPTIONS.find(
            (option) => option.id === calculatorStore.supportHours,
          ) || RENDERED_OPTIONS[0]
        }
        options={RENDERED_OPTIONS}
        optionValue="id"
        optionTextValue="name"
        placeholder="Select support hours"
        itemComponent={(props) => (
          <Select.Item item={props.item} class="p-2">
            <Select.ItemLabel>{props.item.rawValue.name}</Select.ItemLabel>
          </Select.Item>
        )}
        onChange={(value) => {
          if (value) {
            setCalculatorStore("supportHours", value.id);
          }
        }}
      >
        <Select.Trigger class="flex items-center gap-2 rounded border border-gray-dark-mode-200 bg-gray-light-mode-50 px-4 py-2 text-sm text-black shadow dark:bg-gray-dark-mode-100">
          <Select.Value<(typeof RENDERED_OPTIONS)[number]> class="text-balance">
            {(state) => state.selectedOption().name}
          </Select.Value>
          <Select.Icon>
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
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content class="z-20">
            <Select.Listbox class="rounded bg-gray-light-mode-50 text-sm text-black shadow dark:bg-gray-dark-mode-100" />
          </Select.Content>
        </Select.Portal>
      </Select>
      <button
        class="w-5 min-w-5 cursor-pointer"
        aria-label={"Open details"}
        aria-haspopup="dialog"
        aria-controls={`support-hours-modal`}
        data-hs-overlay={`#support-hours-modal`}
        on:click={toggleOpen}
      >
        <InfoIcon />
      </button>

      <Modal
        open={open()}
        toggleOpen={toggleOpen}
        id="support-hours-modal"
        title={`Details: Support Hours`}
      >
        <SupportHoursDescription />
      </Modal>
    </div>
  );
};

export default SupportHoursInput;
