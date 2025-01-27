import { NUMBER_FORMAT } from "@/lib/utils.ts";
import {
  PRIORITY_SUPPORT_MULTIPLIER,
} from "@/pages/support/_components/priceConstants.ts";
import CalculatorDescriptionContainer from "@/pages/support/_components/solid/details/CalculatorDescriptionContainer.tsx";

const PrioritySupportEnabledDescription = () => (
  <CalculatorDescriptionContainer>
    <p>Our support plans come with three different levels of issue priority:</p>
    <ul class="flex list-inside flex-col gap-4 pl-4">
      <li>
        <b>P1:</b> any issue that renders your user-facing systems either
        completely unavailable or functionally unavailable due to performance,
        correctness, or security issues in the managed infrastructure.
      </li>
      <li>
        <b>P2:</b> any non-P1 issue that disrupts your normal business
        operations or prevents a customer from deploying software updates to the
        managed infrastructure.
      </li>
      <li>
        <b>P3:</b> any non-P1 and non-P2 problem, issue, or question relating to
        infrastructure or software created by and / or managed by us.
      </li>
    </ul>
    <p>Issues come with the following SLAs:</p>
    <table class="border-secondary w-full min-w-full table-fixed border-collapse overflow-y-visible rounded-md border lg:min-w-[990px]">
      <thead>
        <tr>
          <th class="bg-secondary border-secondary text-secondary border-b p-3 text-start text-sm tracking-wide">
            Priority Level
          </th>
          <th class="bg-secondary border-secondary text-secondary border-b p-3 text-start text-sm tracking-wide">
            Response Time SLA<sup class="align-super">*</sup>
          </th>
          <th class="bg-secondary border-secondary text-secondary border-b p-3 text-start text-sm tracking-wide">
            Resolution Time SLA<sup class="align-super">*</sup>
          </th>
          <th class="bg-secondary border-secondary text-secondary border-b p-3 text-start text-sm tracking-wide">
            Requires Priority Support
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="p-3">P1</td>
          <td class="p-3">15 Minutes</td>
          <td class="p-3">4 Hours</td>
          <td class="p-3">Yes</td>
        </tr>
        <tr>
          <td class="p-3">P2</td>
          <td class="p-3">1 Hour</td>
          <td class="p-3">8 Hours</td>
          <td class="p-3">Yes</td>
        </tr>
        <tr>
          <td class="p-3">P3</td>
          <td class="p-3">8 Hours</td>
          <td class="p-3">N/A</td>
          <td class="p-3">No</td>
        </tr>
      </tbody>
    </table>
    <p>
      If your support plan does <b>not</b> include Priority Support, all issues
      will be treated as P3.
    </p>
    <p>
      Enabling Priority Support costs{" "}
      {NUMBER_FORMAT.format(PRIORITY_SUPPORT_MULTIPLIER * 100)}% of your base
      support plan price.
    </p>
    <p class="text-xs">
      <sup class="align-super">*</sup>For the purposes of SLA attainment, time
      only elapses during the selected support hours.
    </p>
  </CalculatorDescriptionContainer>
);

export default PrioritySupportEnabledDescription;
