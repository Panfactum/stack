import { FiShare } from "solid-icons/fi";
import { HiSolidMagnifyingGlassPlus } from "solid-icons/hi";
import { type Component, createMemo, createSignal } from "solid-js";

import Button from "@/components/ui/Button.tsx";
import { SIGNUP_LINK } from "@/lib/constants.ts";
import { CURRENCY_FORMAT } from "@/lib/utils.ts";
import { calculateSavings } from "@/pages/_components/SavingsCalculator/calculateSavings.tsx";
import {
  calculatorStore,
  shareCalculatorValues,
} from "@/pages/_components/calculatorStore.tsx";

import SavingsDetails from "./SavingsDetails.tsx";

const SavingsSummary: Component = () => {
  const [detailsOpened, setDetailsOpened] = createSignal<boolean>(false);
  const savingsLineItems = createMemo(() => {
    return calculateSavings({ ...calculatorStore });
  });
  const totalSavings = () =>
    savingsLineItems().reduce((acc, cur) => {
      return acc + cur.savings;
    }, 0);

  return (
    <div
      class={`bg-primary flex w-full flex-col items-center gap-y-8 rounded-xl p-6 md:flex-row md:justify-between md:py-3`}
    >
      <div class="flex flex-col items-center gap-y-4 md:items-start">
        <h3 class="pt-4 font-semibold">Total Savings</h3>

        <div class="text-display-lg rounded font-machina font-medium">
          {CURRENCY_FORMAT.format(totalSavings())} / month
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 md:max-w-2/5 lg:max-w-full lg:grid-cols-3">
        <Button
          onClick={() => {
            shareCalculatorValues("savings-calculator");
          }}
          variant="secondary"
          class="lg:mx-auto lg:w-fit"
        >
          <div class="flex items-center justify-center gap-2 lg:justify-between">
            <span class="text-balance">Copy Shareable Link</span>
            <span class="block md:hidden lg:block">
              <FiShare />
            </span>
          </div>
        </Button>
        <Button
          onClick={() => setDetailsOpened(!detailsOpened())}
          variant="secondary"
          class="lg:mx-auto lg:w-fit"
        >
          <div class="flex items-center justify-center gap-2 lg:justify-between">
            <span class="text-balance">Show Details</span>
            <span class="block md:hidden lg:block">
              <HiSolidMagnifyingGlassPlus />
            </span>
          </div>
        </Button>
        <a href={SIGNUP_LINK} class="col-span-2 lg:col-span-1">
          <Button variant="primary" class="w-full">
            Start Saving
          </Button>
        </a>
        {/*We conditionally add the details modal to the DOM b/c it is very expensive to update its DOM when the user changes calculator values*/}
        {detailsOpened() && (
          <SavingsDetails
            open={detailsOpened()}
            onToggle={() => setDetailsOpened(!detailsOpened())}
            lineItems={savingsLineItems()}
          />
        )}
      </div>
    </div>
  );
};

export default SavingsSummary;
