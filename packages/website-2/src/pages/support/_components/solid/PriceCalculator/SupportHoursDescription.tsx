import { For } from "solid-js";

import { NUMBER_FORMAT } from "@/lib/utils.ts";
import {
  SUPPORT_HOURS_OPTIONS,
} from "@/pages/support/_components/priceConstants.ts";
import CalculatorDescriptionContainer from "@/pages/support/_components/solid/details/CalculatorDescriptionContainer.tsx";

const SupportHoursDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      Support Hours are the times during which we will respond to and address
      open issues with the managed infrastructure. We provide multiple tiers to
      allow you to tailor our support to your needs and realize the maximum
      possible savings.
    </p>
    <p>The available Support Hour options:</p>
    <table class="border-secondary w-full min-w-full table-fixed border-collapse overflow-y-visible rounded-md border lg:min-w-[990px]">
      <thead>
        <tr>
          <th class="bg-secondary border-secondary text-secondary border-b p-4 text-start text-sm tracking-wide">
            Tier
          </th>
          <th class="bg-secondary border-secondary text-secondary border-b p-4 text-start text-sm tracking-wide">
            Times
          </th>
          <th class="bg-secondary border-secondary text-secondary border-b p-4 text-start text-sm tracking-wide">
            Multiplier
          </th>
        </tr>
      </thead>
      <tbody>
        <For each={SUPPORT_HOURS_OPTIONS}>{({ name, description, multiplier, excludeHolidays }) => (
            <tr>
              <td class="p-4">{name}</td>
              <td class="p-4">
                {description}
                {excludeHolidays && <sup class="align-super">*</sup>}
              </td>
              <td class="p-4">
                {NUMBER_FORMAT.format(multiplier * 100)}%
              </td>
            </tr>
          )}</For>
      </tbody>
    </table>
    <p>
      The Support Hours cost is a multiplier over the base support plan price.
    </p>
    <p class="text-xs">
      <sup class="align-super">*</sup>Excludes US federal and banking holidays
    </p>
  </CalculatorDescriptionContainer>
);

export default SupportHoursDescription;
