// Main hero section component for the autopilot page
// Presents managed infrastructure services with animated title
import type { Component } from "solid-js";
import { For, onMount, createSignal } from "solid-js";

import { ShimmerButton } from "@/components/ui/ShimmerButton";

export const AutopilotHero: Component = () => {
  const [animationStarted, setAnimationStarted] = createSignal(false);
  const [subtitleVisible, setSubtitleVisible] = createSignal(false);
  const [buttonsVisible, setButtonsVisible] = createSignal(false);

  const titleWords = [
    { text: "Your ", isHighlighted: false },
    { text: "infrastructure", isHighlighted: false },
    { text: "on ", isHighlighted: false },
    { text: "autopilot", isHighlighted: true },
  ];

  onMount(() => {
    // Start title animation after component mounts
    setTimeout(() => setAnimationStarted(true), 100);

    // Start subtitle fade
    setTimeout(() => setSubtitleVisible(true), 650);

    // Show buttons after subtitle
    setTimeout(() => setButtonsVisible(true), 1100);
  });

  return (
    <section
      class={`
        relative overflow-hidden bg-primary py-4
        md:py-12
      `}
    >
      <div
        class={`
          relative z-10 mx-auto max-w-screen-2xl px-6
          md:px-10
          lg:px-16
        `}
      >
        {/* Hero Header */}
        <div
          class={`
            relative py-12 text-center
            md:py-16
          `}
        >
          <h1
            class={`
              relative z-10 mb-2 font-machina text-4xl leading-tight font-bold
              md:text-6xl
              lg:text-7xl
            `}
            style={{
              "text-shadow":
                "0 4px 20px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.7)",
              "pointer-events": "none",
              "user-select": "text",
            }}
          >
            <For each={titleWords}>
              {(word, index) => (
                <>
                  <span
                    class={`
                      inline-block transition-all duration-700 ease-out
                      ${
                        animationStarted()
                          ? "translate-y-0 opacity-100"
                          : "translate-y-8 opacity-0"
                      }
                      ${word.isHighlighted ? "text-brand-400" : ""}
                    `}
                    style={{
                      "transition-delay": `${index() * 150}ms`,
                    }}
                  >
                    {word.text.trim()}
                  </span>
                  {word.text !== "autopilot" && " "}
                </>
              )}
            </For>
          </h1>
          <p
            class={`
              relative z-10 mx-auto mb-8 w-fit max-w-4xl text-display-sm
              text-primary transition-opacity duration-[1500ms]
              ${subtitleVisible() ? "opacity-100" : "opacity-0"}
            `}
            style={{
              "text-shadow":
                "0 2px 10px rgba(0, 0, 0, 0.4), 0 1px 5px rgba(0, 0, 0, 0.6)",
              "pointer-events": "none",
              "user-select": "text",
            }}
          >
            Let our platform experts manage your Panfactum installation so you
            can get back to building
          </p>

          {/* CTA Buttons */}
          <div
            class={`
              flex flex-col items-center justify-center gap-4 transition-opacity
              duration-700 ease-out
              sm:flex-row
              ${buttonsVisible() ? "opacity-100" : "opacity-0"}
            `}
          >
            <a
              href="/pricing"
              class={`
                rounded-lg border border-gray-dark-mode-700
                bg-gray-dark-mode-800 px-6 py-3 text-base
                text-gray-light-mode-300 transition-all
                hover:border-gray-dark-mode-600 hover:bg-gray-dark-mode-700
                hover:text-white
              `}
            >
              Pricing
            </a>
            <ShimmerButton
              href="https://app.reclaim.ai/m/panfactum/panfactum-demo"
              target="_blank"
              rel="noopener noreferrer"
              class="text-base"
            >
              Book a Demo
            </ShimmerButton>
          </div>
        </div>
      </div>
    </section>
  );
};
