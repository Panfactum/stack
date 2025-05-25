import { NUMBER_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/_archived/plus/pricing/_components/PricingSection/SavingsEstimator/details/CalculatorDescriptionContainer";
import { PRIORITY_SUPPORT_MULTIPLIER } from "@/pages/_archived/plus/pricing/_components/PricingSection/priceConstants";

const PrioritySupportEnabledDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      All customer-reported issues are assigned on of three different levels of
      issue priority:
    </p>
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
    <div class="overflow-auto">
      <table class="border-primary w-full min-w-128 table-fixed border-collapse rounded-md border ">
        <thead>
          <tr>
            <th class="bg-secondary border-primary border-b p-3 text-start text-sm tracking-wide">
              Priority Level
            </th>
            <th class="bg-secondary border-primary border-b p-3 text-start text-sm tracking-wide">
              Response Time SLA<sup class="align-super">*</sup>
            </th>
            <th class="bg-secondary border-primary border-b p-3 text-start text-sm tracking-wide">
              Resolution Time SLA<sup class="align-super">*</sup>
            </th>
            <th class="bg-secondary border-primary border-b p-3 text-start text-sm tracking-wide ">
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
    </div>
    <p>
      If your support plan does <b>not</b> include Priority Support, all issues
      will be treated as P3.
    </p>
    <p>
      Enabling Priority Support adds{" "}
      {NUMBER_FORMAT.format(PRIORITY_SUPPORT_MULTIPLIER * 100)}% to your support
      plan price.
    </p>
    <p class="text-xs">
      <sup class="align-super">*</sup>For the purposes of SLA attainment, time
      only elapses during the selected support hours.
    </p>
  </CalculatorDescriptionContainer>
);

export default PrioritySupportEnabledDescription;
