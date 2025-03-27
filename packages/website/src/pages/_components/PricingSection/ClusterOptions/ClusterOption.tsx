import { createMemo, createSignal, type ParentComponent } from "solid-js";

import Modal from "@/components/ui/Modal";
import { CURRENCY_FORMAT } from "@/lib/utils";
import InfoIcon from "@/pages/_components/PricingSection/SavingsEstimator/InfoIcon";

import IntegerIncrementer from "../IntegerIncrementer";

interface ClusterOptionProps {
  title: string;
  price: number;
  description: string;
  value: number;
  onChange: (value: number) => void;
}

const ClusterOption: ParentComponent<ClusterOptionProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const toggleOpen = () => setOpen((prev) => !prev);
  const id = createMemo(() => `cluster-option-${props.title}`);
  return (
    <div class="bg-tertiary flex basis-1/3 flex-col gap-4 border-x-2 border-gray-light-mode-400 p-4 pl-8 first:border-b-2 last:border-t-2 md:p-8 md:pl-16 lg:pl-8 lg:first:border-0 lg:first:border-l-2 lg:last:border-0 lg:last:border-r-2 dark:border-gray-dark-mode-800">
      <div class="flex justify-between gap-2">
        <div class="flex flex-col gap-2">
          <div class="flex gap-4 text-nowrap">
            <div class="font-semibold">{props.title}</div>
            <button
              class="w-5 cursor-pointer"
              aria-label={"Open details"}
              aria-haspopup="dialog"
              aria-controls={id()}
              data-hs-overlay={`#${id()}`}
              on:click={toggleOpen}
            >
              <InfoIcon />
            </button>
          </div>

          <div class="text-nowrap font-machina text-2xl font-semibold">
            {CURRENCY_FORMAT.format(props.price)}{" "}
            <span class="text-secondary text-sm">/ month / env</span>
          </div>
        </div>
        <IntegerIncrementer value={props.value} onChange={props.onChange} />
      </div>

      <div class="text-secondary text-sm md:text-base">{props.description}</div>

      <Modal
        open={open()}
        toggleOpen={toggleOpen}
        id={id()}
        title={`Details: ${props.title}`}
      >
        {props.children}
      </Modal>
    </div>
  );
};

export default ClusterOption;
