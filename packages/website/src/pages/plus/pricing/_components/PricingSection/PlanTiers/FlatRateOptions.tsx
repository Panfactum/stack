import type { Component } from "solid-js";

const FlatRateOptions: Component = () => {
  return (
    <div class="flex flex-col gap-2 border-b-2 border-gray-light-mode-400 p-4 py-6 md:p-8 dark:border-gray-dark-mode-800">
      <div class="text-display-md text-balance font-machina font-medium">
        Unlimited, Flat-Rate Startup Plan
      </div>
      <div class="text-secondary text-sm md:text-base">
        While your AWS spend is under $2,500 / month, we will provide unlimited
        support for your Panfactum infrastructure at a simple flat monthly rate.
      </div>
    </div>
  );
};

export default FlatRateOptions;
