import { type Component, createMemo, For } from "solid-js";

import Button from "@/components/ui/Button.tsx";
import Modal from "@/components/ui/Modal.tsx";
import { SIGNUP_LINK } from "@/lib/constants.ts";
import type { SavingsLineItem } from "@/pages/_components/SavingsCalculator/calculateSavings.tsx";

import SavingsDetailsTableRow from "./SavingsDetailsTableRow.tsx";
import DetailsTableColumnHeader from "../details/DetailsTableColumnHeader.tsx";

interface PriceDetailsProps {
  open: boolean;
  onToggle: () => void;
  lineItems: SavingsLineItem[];
}

const SavingsDetails: Component<PriceDetailsProps> = (props) => {
  const baseCost = createMemo(() =>
    props.lineItems.reduce((acc, cur) => acc + cur.baseCost, 0),
  );
  const stackCost = createMemo(() =>
    props.lineItems.reduce((acc, cur) => acc + cur.stackCost, 0),
  );
  const savings = createMemo(() => baseCost() - stackCost());
  const savingsPercent = createMemo(() => savings() / baseCost());

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
              <For each={props.lineItems}>{(lineItem) => (
                <SavingsDetailsTableRow lineItem={lineItem} />
              )}</For>
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
          <a href={SIGNUP_LINK}>
            <Button variant="primary">Schedule a Call</Button>
          </a>
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
