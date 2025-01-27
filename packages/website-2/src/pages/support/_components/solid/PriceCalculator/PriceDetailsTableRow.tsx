import type { Component } from "solid-js";

import { CURRENCY_FORMAT } from "@/lib/utils.ts";

import type { PlanPriceLineItem } from "./calculatePlanPrice.ts";
import DetailsTableElement from "../details/DetailsTableElement.tsx";

interface PriceDetailsTableRowProps {
  lineItem: PlanPriceLineItem;
  accent?: boolean;
}
const PriceDetailsTableRow: Component<PriceDetailsTableRowProps> = (props) => {
  const unitPriceRendered = () => {
    const unitPrice = props.lineItem.unitPrice;
    return unitPrice === -1
      ? "-"
      : unitPrice > 1
        ? CURRENCY_FORMAT.format(unitPrice)
        : `${100 * unitPrice}%`;
  };
  const quantityRendered = () => {
    const unitPrice = props.lineItem.unitPrice;
    const quantity = props.lineItem.quantity;
    return quantity === -1
      ? "-"
      : unitPrice > 1
        ? `${quantity}`
        : CURRENCY_FORMAT.format(quantity);
  };
  const subTotalRendered = () =>
    CURRENCY_FORMAT.format(props.lineItem.subTotal);

  return (
    <tr
      class={`m-0 ${props.accent ? " bg-accent-dark" : "bg-primary"} border-secondary border-b border-r border-solid`}
    >
      <th
        class={`${props.accent ? "bg-accent-dark" : "bg-secondary"} whitespace-nowrap px-4 text-left text-sm font-medium tracking-wide`}
      >
        <span class={`${props.accent ? "" : "pl-2"}`}>
          {props.lineItem.name}
        </span>
      </th>
      <DetailsTableElement accent={props.accent}>
        {unitPriceRendered()}
      </DetailsTableElement>
      <DetailsTableElement accent={props.accent}>
        {quantityRendered()}
      </DetailsTableElement>
      <DetailsTableElement accent={true}>
        {subTotalRendered()}
      </DetailsTableElement>
    </tr>
  );
};

export default PriceDetailsTableRow;
