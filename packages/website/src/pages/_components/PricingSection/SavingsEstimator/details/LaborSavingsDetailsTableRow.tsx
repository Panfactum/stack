import type { Component } from "solid-js";

import { CURRENCY_FORMAT } from "@/lib/utils.ts";

import DetailsTableElement from "./DetailsTableElement.tsx";
import type { SavingsLineItem } from "../calculations/calculateSavings.tsx";

interface SavingsDetailsTableRowProps {
  lineItem: SavingsLineItem;
  accent?: boolean;
}
const SavingsDetailsTableRow: Component<SavingsDetailsTableRowProps> = (
  props,
) => {
  const baseCostRendered = () =>
    CURRENCY_FORMAT.format(props.lineItem.laborSavings ?? 0);
  const stackCostRendered = () => CURRENCY_FORMAT.format(0);
  const savingsRendered = () =>
    `${CURRENCY_FORMAT.format(props.lineItem.laborSavings ?? 0)}`;

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
        description={props.lineItem.laborSavingsDescription}
        accent={props.accent}
      >
        {baseCostRendered()}
      </DetailsTableElement>
      <DetailsTableElement accent={props.accent}>
        {stackCostRendered()}
      </DetailsTableElement>
      <DetailsTableElement accent={true}>
        {savingsRendered()}
      </DetailsTableElement>
    </tr>
  );
};

export default SavingsDetailsTableRow;
