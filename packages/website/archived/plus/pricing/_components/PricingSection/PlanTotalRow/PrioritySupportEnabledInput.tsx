import { createSignal, type Component } from "solid-js";

import Modal from "@/components/ui/Modal";
import InfoIcon from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/InfoIcon";

import PrioritySupportEnabledDescription from "./PrioritySupportEnabledDescription";
import { SwitchInput } from "../SwitchInput";
import { setCalculatorStore, calculatorStore } from "../calculatorStore";

const PrioritySupportEnabledInput: Component = () => {
  const [open, setOpen] = createSignal(false);
  const toggleOpen = () => setOpen((prev) => !prev);
  return (
    <div class="flex items-center gap-4">
      <SwitchInput
        label="Priority Support (+20%)"
        checked={calculatorStore.prioritySupportEnabled}
        onChange={(checked) => {
          setCalculatorStore("prioritySupportEnabled", checked);
        }}
      />
      <button
        class="w-5 cursor-pointer"
        aria-label={"Open details"}
        aria-haspopup="dialog"
        aria-controls={`priority-support-modal`}
        data-hs-overlay={`#priority-support-modal`}
        on:click={toggleOpen}
      >
        <InfoIcon />
      </button>

      <Modal
        open={open()}
        toggleOpen={toggleOpen}
        id="priority-support-modal"
        title={`Details: Priority Support`}
      >
        <PrioritySupportEnabledDescription />
      </Modal>
    </div>
  );
};

export default PrioritySupportEnabledInput;
