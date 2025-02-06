import { For } from "solid-js";
import type { Component } from "solid-js";

import Button from "@/components/ui/Button.tsx";
import Modal from "@/components/ui/Modal.tsx";
import { SIGNUP_LINK } from "@/lib/constants.ts";
import PriceDetailsTableRow from "@/pages/_components/PriceCalculator/PriceDetailsTableRow.tsx";

import type { PlanPriceLineItem } from "./calculatePlanPrice.ts";
import DetailsTableColumnHeader from "../details/DetailsTableColumnHeader.tsx";

interface PriceDetailsProps {
  open: boolean;
  onToggle: () => void;
  lineItems: PlanPriceLineItem[];
  total: number;
}

const PriceDetails: Component<PriceDetailsProps> = (props) => {
  return (
    <Modal
      open={props.open}
      id={"support-plan-price-details"}
      toggleOpen={props.onToggle}
      title={"Support Plan Pricing Details"}
    >
      <div class="flex w-full max-w-screen-md flex-col items-center gap-4 lg:max-w-screen-xl">
        <h4 class="w-full">
          A detailed breakdown of how the support plan price was calculated:
        </h4>
        <div class="max-w-full overflow-x-scroll">
          <table class="border-secondary border-collapse rounded-md border">
            <thead>
              <tr>
                <DetailsTableColumnHeader>Line Item</DetailsTableColumnHeader>
                <DetailsTableColumnHeader>Unit Price</DetailsTableColumnHeader>
                <DetailsTableColumnHeader>Quantity</DetailsTableColumnHeader>
                <DetailsTableColumnHeader>Total</DetailsTableColumnHeader>
              </tr>
            </thead>
            <tbody>
              <For each={props.lineItems}>{(lineItem) => (
                <PriceDetailsTableRow lineItem={lineItem} />
              )}</For>
              <PriceDetailsTableRow
                accent={true}
                lineItem={{
                  name: "Total",
                  unitPrice: -1,
                  quantity: -1,
                  subTotal: props.total,
                }}
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
        <p class="self-start text-xs">
          <em>
            The prices shown here are for estimation purposes only. A final
            quote will be provided before contract signing.
          </em>
        </p>
      </div>
    </Modal>
  );
};

export default PriceDetails;
