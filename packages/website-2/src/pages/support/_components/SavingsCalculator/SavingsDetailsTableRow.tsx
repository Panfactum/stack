import type { Component } from "solid-js";

import { CURRENCY_FORMAT, NUMBER_FORMAT } from "@/lib/utils.ts";
import type { SavingsLineItem } from "@/pages/support/_components/SavingsCalculator/calculateSavings.tsx";

import DetailsTableElement from "../details/DetailsTableElement.tsx";

interface SavingsDetailsTableRowProps {
  lineItem: SavingsLineItem;
  accent?: boolean;
}
const SavingsDetailsTableRow: Component<SavingsDetailsTableRowProps> = (
  props,
) => {
  const baseCostRendered = () =>
    CURRENCY_FORMAT.format(props.lineItem.baseCost);
  const stackCostRendered = () =>
    CURRENCY_FORMAT.format(props.lineItem.stackCost);
  const savingsRendered = () =>
    `${CURRENCY_FORMAT.format(props.lineItem.savings)} (${NUMBER_FORMAT.format(props.lineItem.savingsPercent * 100)}%)`;

  return (
    <tr class={`m-0 ${props.accent ? "bg-accent-dark" : "bg-primary"} h-full`}>
      <th
        class={`${props.accent ? "bg-accent-dark" : ""}  whitespace-nowrap px-4 text-left text-sm font-medium tracking-wide`}
      >
        <span class={`${props.accent ? "" : "pl-2"}`}>
          {props.lineItem.name}
        </span>
      </th>
      <DetailsTableElement
        description={props.lineItem.baseCostDescription}
        accent={props.accent}
      >
        {baseCostRendered()}
      </DetailsTableElement>
      <DetailsTableElement
        description={props.lineItem.stackCostDescription}
        accent={props.accent}
      >
        {stackCostRendered()}
      </DetailsTableElement>
      <DetailsTableElement accent={true}>
        {savingsRendered()}
      </DetailsTableElement>
    </tr>
  );
};

export default SavingsDetailsTableRow;
