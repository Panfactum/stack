import { For } from "solid-js";
import type { Component } from "solid-js";

import SavingsDescriptionLineItem from "./SavingsDescriptionLineItem.tsx";
import SavingsDescriptionTotalLine from "./SavingsDescriptionTotalLine.tsx";

interface SavingsDescriptionProps {
  lineItems: Array<{ content: string; operation?: string } | null>;
}

const SavingsDescription: Component<SavingsDescriptionProps> = (props) => {
  return (
    <div class="flex w-fit flex-col">
      <For each={props.lineItems}>{(item) => {
        if (item) {
          return <SavingsDescriptionLineItem {...item} />;
        } else {
          return <SavingsDescriptionTotalLine />;
        }
      }}</For>
    </div>
  );
};

export default SavingsDescription;
