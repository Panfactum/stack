import { Button } from "@kobalte/core/button";
import { type Component, createMemo, For, onMount } from "solid-js";

import Modal from "@/components/ui/Modal.tsx";

import DetailsTableColumnHeader from "./DetailsTableColumnHeader.tsx";
import SavingsDetailsTableRow from "./SavingsDetailsTableRow.tsx";
import CalendarIcon from "../../images/CalendarIcon.tsx";
import type { SavingsLineItem } from "../calculations/calculateSavings.tsx";
interface PriceDetailsProps {
  open: boolean;
  onToggle: () => void;
  lineItems: SavingsLineItem[];
}

const SavingsDetails: Component<PriceDetailsProps> = (props) => {
  const baseCost = createMemo(() =>
    props.lineItems.reduce((acc, cur) => acc + (cur.baseCost ?? 0), 0),
  );
  const stackCost = createMemo(() =>
    props.lineItems.reduce((acc, cur) => acc + (cur.stackCost ?? 0), 0),
  );
  const savings = createMemo(() => baseCost() - stackCost());
  const savingsPercent = createMemo(() => savings() / baseCost());

  onMount(() => {
    const script = document.createElement("script");
    script.src = "https://server.fillout.com/embed/v1/";
    script.async = true;
    document.body.appendChild(script);
  });

  return (
    <Modal
      open={props.open}
      id={"savings-details"}
      toggleOpen={props.onToggle}
      title={"Estimated Savings"}
    >
      <div class="flex max-h-[75vh] max-w-[80vw] flex-col items-center gap-6 p-4">
        <h4 class="w-full">
          A detailed estimate of how much we can save you on cloud
          infrastructure management:
        </h4>
        <div class="max-w-full overflow-x-scroll">
          <table class="border-secondary h-auto min-w-full table-fixed border-collapse rounded-md border">
            <thead>
              <tr class="h-full">
                <DetailsTableColumnHeader>Line Item</DetailsTableColumnHeader>
                <DetailsTableColumnHeader>
                  Managed Service Cost
                </DetailsTableColumnHeader>
                <DetailsTableColumnHeader>
                  Panfactum Cost
                </DetailsTableColumnHeader>
                <DetailsTableColumnHeader>
                  Monthly Savings
                </DetailsTableColumnHeader>
              </tr>
            </thead>
            <tbody>
              <For each={props.lineItems}>
                {(lineItem) => <SavingsDetailsTableRow lineItem={lineItem} />}
              </For>
              <SavingsDetailsTableRow
                lineItem={{
                  name: "Total Savings",
                  baseCost: baseCost(),
                  stackCost: stackCost(),
                  savings: savings(),
                  savingsPercent: savingsPercent(),
                }}
                accent={true}
              />
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-center gap-8">
          <p class="text-center text-lg font-semibold">Ready to Get Started?</p>
          <Button
            onClick={props.onToggle}
            data-fillout-id="5Ce2EHxTqnus"
            data-fillout-embed-type="popup"
            data-fillout-dynamic-resize
            data-fillout-inherit-parameters
            data-fillout-popup-size="medium"
            class="flex cursor-pointer items-center gap-4 text-nowrap rounded bg-gray-dark-mode-300 px-4 py-2 font-semibold text-gray-light-mode-800 shadow shadow-gray-dark-mode-400 hover:bg-gray-dark-mode-500"
          >
            <span class="size-6">
              <CalendarIcon />
            </span>
            Schedule a Call
          </Button>
        </div>
        <p class="text-xs">
          <em>
            Calculated savings are for estimation purposes only. A final savings
            target will be provided before contract signing.
          </em>
        </p>
      </div>
    </Modal>
  );
};

export default SavingsDetails;
