// CTA section component for the homepage
// Displays a call to action to book a demo or view the open source stack

import type { Component } from "solid-js";

import { ShimmerButton } from "@/components/ui/ShimmerButton";

export const CTASection: Component = () => {
  return (
    <section
      class={`
        mx-auto max-w-screen-2xl px-6 py-20
        md:px-10
        lg:px-16
      `}
    >
      <div
        class={`
          flex flex-col items-center gap-10 rounded-2xl bg-gradient-to-r
          from-brand-800 to-brand-900 p-10 text-center
          md:p-16
        `}
      >
        <h2
          class={`
            max-w-3xl font-machina text-3xl font-bold
            md:text-5xl
          `}
        >
          Got Questions?
        </h2>
        <p class="max-w-3xl text-xl text-gray-light-mode-300">
          Talk to a Panfactum engineer to learn more about our approach and
          platform.
        </p>
        <div
          class={`
            mt-4 flex flex-col gap-6
            sm:flex-row
          `}
        >
          <ShimmerButton
            href="https://app.reclaim.ai/m/panfactum/panfactum-demo"
            class="text-lg font-bold"
          >
            Book a Call
          </ShimmerButton>
        </div>
      </div>
    </section>
  );
};
