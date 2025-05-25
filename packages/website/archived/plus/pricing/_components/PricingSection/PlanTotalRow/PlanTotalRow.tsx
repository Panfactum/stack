import { Collapsible } from "@kobalte/core/collapsible";
import { clsx } from "clsx";
import { createSignal, type Component } from "solid-js";

import { CURRENCY_FORMAT } from "@/lib/utils";

import PrioritySupportEnabledInput from "./PrioritySupportEnabledInput";
import SupportHoursInput from "./SupportHoursInput";
import { SwitchInput } from "../SwitchInput";

const PlanTotalRow: Component<{ price: number; daysToLaunch: number }> = (
  props,
) => {
  const [supportModifiersOpen, setSupportModifiersOpen] = createSignal(false);

  return (
    <div class="flex flex-col justify-between gap-x-8 gap-y-4 md:flex-row">
      <div class="flex flex-col items-center px-4 pt-6 md:items-start md:border-b-0 md:px-8">
        <div
          class={clsx(
            "text-display-xs flex h-6 items-center gap-4 font-semibold",
          )}
        >
          <span>Support Modifiers</span>
          <SwitchInput
            label="Support Modifiers"
            labelHidden={true}
            checked={supportModifiersOpen()}
            onChange={(checked) => {
              setSupportModifiersOpen(checked);
            }}
          />
        </div>
        <Collapsible open={supportModifiersOpen()}>
          <Collapsible.Content class="mt-6 flex animate-kobalte-collapsible-up flex-col gap-4 overflow-hidden data-[expanded]:animate-kobalte-collapsible-down md:mb-6">
            <SupportHoursInput />
            <PrioritySupportEnabledInput />
          </Collapsible.Content>
        </Collapsible>
      </div>
      <div class="flex flex-col items-center gap-4 p-4 py-6 md:p-8">
        <div class="text-display-xs text-nowrap font-semibold md:w-full">
          Get a <span class="italic">full team</span> of cloud engineers for
        </div>

        <div class="text-display-sm flex items-baseline justify-end gap-2 font-machina text-gold-500 md:w-full">
          <span class="text-display-xl font-semibold">
            {CURRENCY_FORMAT.format(props.price)}
          </span>{" "}
          / month
        </div>
      </div>
    </div>
  );
};

export default PlanTotalRow;
