import { FaRegularCircleCheck } from "solid-icons/fa";
import { onMount, type Component, For } from "solid-js";

import { ShieldIcon } from "../images/ShieldIcon";

const GUARANTEES = [
  "Free savings assessment before contract signing",
  "If we miss the target, we pay the difference",
  "45-day, no-questions-asked refunds",
];

const EnterpriseOptions: Component = () => {
  onMount(() => {
    const script = document.createElement("script");
    script.src = "https://server.fillout.com/embed/v1/";
    script.async = true;
    document.body.appendChild(script);
  });
  return (
    <div class="flex flex-col">
      <div class="flex flex-col-reverse justify-between gap-x-16 gap-y-4 p-4 py-6 md:flex-row md:p-8">
        <div class="flex flex-col gap-2">
          <div class="text-display-md text-balance font-machina font-medium">
            Enterprise Discount Program
          </div>
          <div class="text-secondary text-sm md:text-base">
            For enterprise customers, we craft custom plans tailored to your
            unique needs to maximize both your infrastructure and labor savings.
            We work hand-in-hand with your existing cloud engineers to optimize
            your cloud strategy and ensure your engineers no longer need to
            waste time on undifferentiated toil.
          </div>
        </div>
        <div class="text-display-md flex items-center text-nowrap font-machina font-semibold text-brand-600 dark:text-brand-300">
          Custom Pricing
        </div>
      </div>
      <div class="bg-tertiary flex rounded-b-xl border-t-2 border-gray-light-mode-400 p-4 py-6 md:p-8 dark:border-2 dark:border-gray-dark-mode-800">
        <div class="relative hidden w-full flex-col items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 p-10 text-center md:flex dark:from-brand-800 dark:to-brand-700">
          <div class="size-32">
            <ShieldIcon />
          </div>

          <p class="text-display-lg font-machina font-semibold">
            The Panfactum Guarantee
          </p>

          <p class="text-display-sm mb-8">
            We save you money or our service is free.
          </p>

          <div class="mb-8 flex flex-col gap-4">
            <For each={GUARANTEES}>
              {(item) => (
                <div class="text-display-xs grid max-w-[600px] grid-cols-10 gap-4 text-left">
                  <div class="col-span-1 flex items-center">
                    {<FaRegularCircleCheck width={24} height={24} />}
                  </div>
                  <div class="col-span-9">
                    <p class="">{item}</p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
        <div
          class="w-full"
          data-fillout-id="e33kELyCtHus"
          data-fillout-embed-type="standard"
          data-fillout-inherit-parameters
          data-fillout-dynamic-resize
        />
      </div>
    </div>
  );
};

export default EnterpriseOptions;
