import { FiShare } from "solid-icons/fi";
import { HiSolidMagnifyingGlassPlus } from "solid-icons/hi";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";

import { useBackgroundContext } from "@/components/context/background.ts";
import Button from "@/components/ui/Button.tsx";
import { SIGNUP_LINK } from "@/lib/constants.ts";
import { CURRENCY_FORMAT } from "@/lib/utils.ts";
import PriceDetails from "@/pages/support/_components/PriceCalculator/PriceDetails.tsx";
import { calculatePlanPrice } from "@/pages/support/_components/PriceCalculator/calculatePlanPrice.ts";
import {
  calculatorStore,
  setCalculatorStore, shareCalculatorValues,
} from "@/pages/support/_components/calculatorStore.ts";


const PriceSummary: Component = () => {
  const [detailsOpened, setDetailsOpened] = createSignal<boolean>(false);
  const background = useBackgroundContext();

  const price = createMemo(() =>
    calculatePlanPrice({
      workloadCount: calculatorStore.workloadCount,
      clusterCount: calculatorStore.clusterCount,
      prioritySupportEnabled: calculatorStore.prioritySupportEnabled,
      supportHours: calculatorStore.supportHours,
      startupDiscountEnabled: calculatorStore.startupDiscountEnabled,
      annualSpendCommitmentEnabled:
        calculatorStore.annualSpendCommitmentEnabled,
    }),
  );

  // Probably better to hoist this to the root scope to ensure that this field always updates
  // regardless of whether this component is mounted. However, for now it is fine.
  createEffect(() => {
    setCalculatorStore("supportPlanPrice", price().total);
  });

  return (
    <div
      class={`flex w-full flex-col items-center gap-y-8 md:flex-row md:justify-between ${background === "primary" ? "bg-secondary" : "bg-primary"} mt-10 rounded-xl px-6 py-3`}
    >
      <div class="flex flex-col items-center gap-y-3 md:items-start">
        <h3 class="pt-4 font-semibold">Support Plan Price</h3>

        <div class="text-display-lg rounded font-machina font-medium">
          {CURRENCY_FORMAT.format(price().total)} / month
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Button
          onClick={shareCalculatorValues}
          variant="secondary"
        >
          <div class="flex items-center justify-between gap-2">
            <span>Share Link</span>
            <FiShare />
          </div>
        </Button>
        <Button
          onClick={() => {
            setDetailsOpened(!detailsOpened());
          }}
          variant="secondary"
        >
          <div class="flex items-center justify-between gap-2">
            <span>Show Details</span>
            <HiSolidMagnifyingGlassPlus />
          </div>
        </Button>
        <a href={SIGNUP_LINK} class="col-span-2 lg:col-span-1">
          <Button variant="primary" class="w-full">
            Connect
          </Button>
        </a>
        {/*We conditionally add the details modal to the DOM b/c it is very expensive to update its DOM when the user changes calculator values*/}
        {detailsOpened() && (
          <PriceDetails
            open={detailsOpened()}
            onToggle={() => setDetailsOpened(!detailsOpened())}
            lineItems={price().lineItems}
            total={price().total}
          />
        )}
      </div>
    </div>
  );
};

export default PriceSummary;
