import { Button } from "@kobalte/core/button";
import { Collapsible } from "@kobalte/core/collapsible";
import { Switch } from "@kobalte/core/switch";
import { clsx } from "clsx";
import { HiSolidMagnifyingGlass } from "solid-icons/hi";
import { ImShare } from "solid-icons/im";
import {
  createEffect,
  createMemo,
  createSignal,
  type Component,
} from "solid-js";

import { CURRENCY_FORMAT, NUMBER_FORMAT } from "@/lib/utils";

import SavingsCalculator from "./AdvancedCalculator";
import { calculateSavings } from "./calculations/calculateSavings";
import InfrastructureSavingsDetails from "./details/InfrastructureSavingsDetails";
import LaborSavingsDetails from "./details/LaborSavingsDetails";
import { calculatorStore, shareCalculatorValues } from "../calculatorStore";
import { InfraIcon } from "../images/InfraIcon";
import { UsersIcon } from "../images/UsersIcon";

const SavingsEstimator: Component<{
  supportPlanPrice: number;
}> = (props) => {
  const [showDetails, setShowDetails] = createSignal<boolean>(false);
  const [advancedMode, setAdvancedMode] = createSignal<boolean>(false);
  const [showInfrastructureDetails, setShowInfrastructureDetails] =
    createSignal<boolean>(false);
  const [showLaborDetails, setShowLaborDetails] = createSignal<boolean>(false);
  const savings = createMemo(() => calculateSavings(calculatorStore));
  const infraSavingsLineItems = createMemo(() =>
    savings().filter((item) => item.savings !== undefined),
  );
  const laborSavingsLineItems = createMemo(() =>
    savings().filter((item) => item.hoursSaved !== undefined),
  );

  const infrastructureSavings = createMemo(() =>
    savings().reduce((acc, curr) => acc + (curr.savings ?? 0), 0),
  );
  const laborSavings = createMemo(() =>
    savings().reduce((acc, curr) => acc + (curr.hoursSaved ?? 0), 0),
  );

  const totalSavings = createMemo(
    () =>
      infrastructureSavings() +
      laborSavings() * calculatorStore.laborHourlyCost -
      props.supportPlanPrice,
  );

  createEffect(() => {
    if (showDetails()) {
      const script = document.createElement("script");
      script.src = "https://server.fillout.com/embed/v1/";
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return (
    <div class="w-full">
      <div
        class={clsx(
          "bg-tertiary mx-auto flex w-[95%] flex-col items-center rounded-b-lg shadow shadow-gray-dark-mode-800",
        )}
      >
        <div
          class={clsx(
            "flex w-full flex-col items-center justify-between gap-6 px-4 py-6 md:flex-row md:px-8",
            showDetails() &&
              "border-t-2 border-gray-light-mode-300 dark:border-gray-dark-mode-800",
          )}
        >
          <div class="flex flex-col items-center gap-x-8 gap-y-6 md:items-start xl:flex-row xl:items-center">
            <div class="text-display-md text-nowrap font-machina font-medium">
              Savings Estimator
            </div>

            <div class="flex items-center gap-8">
              <Switch
                class="inline-flex items-center gap-4"
                checked={showDetails()}
                onChange={setShowDetails}
              >
                <Switch.Input />
                <Switch.Control class="inline-flex h-6 w-12 items-center rounded-full bg-gray-light-mode-400 transition-all duration-200 ease-in-out data-[checked]:bg-brand-500 dark:bg-gray-dark-mode-100 dark:data-[checked]:bg-brand-300">
                  <Switch.Thumb class="size-6 rounded-full bg-gray-dark-mode-200 ring-1 ring-inset ring-gray-dark-mode-400 transition-all duration-200 ease-in-out data-[checked]:translate-x-[calc(100%-1px)]" />
                </Switch.Control>
                <Switch.Label class="text-nowrap font-semibold">
                  Show Details
                </Switch.Label>
              </Switch>
              <Switch
                class={clsx(
                  "hidden items-center gap-4",
                  showDetails() && "md:inline-flex",
                )}
                checked={advancedMode()}
                onChange={setAdvancedMode}
              >
                <Switch.Input />
                <Switch.Control class="inline-flex h-6 w-12 items-center rounded-full bg-gray-light-mode-400 transition-all duration-200 ease-in-out data-[checked]:bg-brand-500 dark:bg-gray-dark-mode-100 dark:data-[checked]:bg-brand-300">
                  <Switch.Thumb class="size-6 rounded-full bg-gray-dark-mode-200 ring-1 ring-inset ring-gray-dark-mode-400 transition-all duration-200 ease-in-out data-[checked]:translate-x-[calc(100%-1px)]" />
                </Switch.Control>
                <Switch.Label class="text-nowrap font-semibold">
                  Advanced Mode
                </Switch.Label>
              </Switch>
            </div>
          </div>

          <div class="relative grow">
            <div
              class={clsx(
                "relative flex h-fit w-full items-center justify-center gap-2 transition-all duration-200 ease-in-out md:justify-end",
                showDetails() && "opacity-0",
              )}
            >
              <div class="text-display-lg flex items-baseline justify-center gap-2 text-nowrap font-machina font-semibold text-success-600 dark:text-success-300">
                {CURRENCY_FORMAT.format(totalSavings())}{" "}
                <span class="text-base">/ month</span>
              </div>
            </div>
            <div
              class={clsx(
                "absolute top-0 flex h-fit w-full items-center justify-center gap-2 transition-all duration-200 ease-in-out md:justify-end",
                !showDetails() && "opacity-0",
              )}
            >
              <Button
                class="flex cursor-pointer items-center gap-2 text-nowrap rounded bg-gray-dark-mode-300 px-4 py-2 font-semibold text-gray-light-mode-800 shadow shadow-gray-dark-mode-400 hover:bg-gray-dark-mode-500"
                disabled={!showDetails()}
                onClick={() => {
                  shareCalculatorValues("pricing");
                }}
              >
                Copy Shareable Link
                <ImShare class="size-5" />
              </Button>
            </div>
          </div>
        </div>
        <Collapsible open={advancedMode()} class="w-full">
          <Collapsible.Content class="animate-kobalte-collapsible-up overflow-hidden border-t-2 border-gray-light-mode-400 bg-gray-light-mode-400 px-4 py-6 data-[expanded]:animate-kobalte-collapsible-down md:px-8 dark:border-gray-dark-mode-800 dark:bg-gray-dark-mode-800">
            <SavingsCalculator />
          </Collapsible.Content>
        </Collapsible>
        <Collapsible open={showDetails()} class="w-full">
          <Collapsible.Content class="relative flex w-full animate-kobalte-collapsible-up justify-center gap-16 overflow-hidden border-t-2 border-gray-light-mode-400 px-4 py-6  data-[expanded]:animate-kobalte-collapsible-down md:px-8 lg:mx-0 lg:justify-between dark:border-gray-dark-mode-800">
            <div
              class="hidden size-full lg:block"
              data-fillout-id="qPCz1EpEoHus"
              data-fillout-embed-type="standard"
              data-fillout-inherit-parameters
              data-fillout-dynamic-resize
            />
            <div class="flex flex-col items-center gap-4">
              <div class="hidden w-full items-center gap-4 md:flex">
                <div class="h-0.5 grow bg-gray-light-mode-300 dark:bg-gray-dark-mode-800" />
                <div class="text-lg font-semibold text-gray-dark-mode-700 dark:text-gray-dark-mode-200">
                  Projected Savings
                </div>
                <div class="h-0.5 grow bg-gray-light-mode-300 dark:bg-gray-dark-mode-800" />
              </div>
              <div class="text-display-lg flex items-baseline justify-center gap-2 font-semibold text-success-600 dark:text-success-300">
                {CURRENCY_FORMAT.format(totalSavings())}{" "}
                <span class="text-base">/ month</span>
              </div>
              <div class="flex max-h-9  items-center justify-center gap-4 text-nowrap rounded-full border-2 border-brand-200 bg-brand-100 py-1 pl-3 pr-4 text-sm text-brand-800 dark:border-brand-500">
                <div class="flex items-center text-nowrap rounded-full border border-brand-500 bg-gray-dark-mode-100 px-4 py-0.5 font-semibold">
                  {NUMBER_FORMAT.format(laborSavings())}
                </div>
                <span class="hidden md:inline">
                  Engineering hours recovered every month
                </span>
                <span class="inline md:hidden">Engineering hours saved</span>
              </div>
              <div class="flex gap-6 md:gap-12">
                <div class="flex flex-col items-center gap-2">
                  <div class="flex items-center gap-2 text-lg">
                    <span class="size-6">
                      <UsersIcon />
                    </span>
                    Labor
                  </div>
                  <div class="text-display-md text-nowrap text-success-600 dark:text-success-300">
                    -
                    {CURRENCY_FORMAT.format(
                      laborSavings() * calculatorStore.laborHourlyCost -
                        props.supportPlanPrice,
                    )}{" "}
                    <span class="text-base">/ month</span>
                  </div>
                  <Button
                    class="mt-2 flex cursor-pointer items-center gap-2 text-nowrap rounded bg-gray-dark-mode-300 px-4 py-2 text-black shadow shadow-gray-dark-mode-400 hover:bg-gray-dark-mode-500"
                    onClick={() => setShowLaborDetails(!showLaborDetails())}
                  >
                    <HiSolidMagnifyingGlass class="size-5" />
                    Show Details
                  </Button>
                  <LaborSavingsDetails
                    open={showLaborDetails()}
                    onToggle={() => setShowLaborDetails(!showLaborDetails())}
                    lineItems={laborSavingsLineItems()}
                    supportPlanPrice={props.supportPlanPrice}
                  />
                </div>
                <div class="flex flex-col items-center gap-2">
                  <div class="flex items-center gap-2 text-lg">
                    <span class="size-5">
                      <InfraIcon />
                    </span>
                    Infrastructure
                  </div>
                  <div class="text-display-md text-nowrap text-success-600 dark:text-success-300">
                    -{CURRENCY_FORMAT.format(infrastructureSavings())}{" "}
                    <span class="text-base">/ month</span>
                  </div>
                  <Button
                    class="mt-2 flex cursor-pointer items-center gap-2 text-nowrap rounded bg-gray-dark-mode-300 px-4 py-2 text-black shadow shadow-gray-dark-mode-400 hover:bg-gray-dark-mode-500"
                    onClick={() =>
                      setShowInfrastructureDetails(!showInfrastructureDetails())
                    }
                  >
                    <HiSolidMagnifyingGlass class="size-5" />
                    Show Details
                  </Button>
                  <InfrastructureSavingsDetails
                    open={showInfrastructureDetails()}
                    onToggle={() =>
                      setShowInfrastructureDetails(!showInfrastructureDetails())
                    }
                    lineItems={infraSavingsLineItems()}
                  />
                </div>
              </div>
            </div>
          </Collapsible.Content>
        </Collapsible>
      </div>
    </div>
  );
};

export default SavingsEstimator;
