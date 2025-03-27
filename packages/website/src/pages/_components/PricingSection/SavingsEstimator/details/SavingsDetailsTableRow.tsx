import type { Component } from "solid-js";

import { CURRENCY_FORMAT, NUMBER_FORMAT } from "@/lib/utils.ts";

import DetailsTableElement from "./DetailsTableElement.tsx";
import type { SavingsLineItem } from "../calculations/calculateSavings.tsx";

interface SavingsDetailsTableRowProps {
  lineItem: SavingsLineItem;
  accent?: boolean;
  hideSavingsPercent?: boolean;
}
const SavingsDetailsTableRow: Component<SavingsDetailsTableRowProps> = (
  props,
) => {
  const baseCostRendered = () =>
    CURRENCY_FORMAT.format(props.lineItem.baseCost ?? 0);
  const stackCostRendered = () =>
    CURRENCY_FORMAT.format(props.lineItem.stackCost ?? 0);
  const savingsRendered = () =>
    `${CURRENCY_FORMAT.format(props.lineItem.savings ?? 0)}${props.hideSavingsPercent ? "" : ` (${NUMBER_FORMAT.format((props.lineItem.savingsPercent ?? 0) * 100)}%)`}`;

  return (
    <tr class={`m-0 ${props.accent ? "bg-accent-dark" : "bg-primary"} h-full`}>
      <th
        class={`${props.accent ? "bg-accent-dark" : "bg-secondary"}  whitespace-nowrap px-4 text-left text-sm font-medium tracking-wide`}
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
