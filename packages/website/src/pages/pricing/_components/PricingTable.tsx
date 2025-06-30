// This component renders the pricing comparison table
// It displays the three tiers (Open Source, DIY, Autopilot) with features and pricing

import { type Component, For, createMemo } from "solid-js";

interface PricingTier {
  name: string;
  price: string;
  forWho: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  isHighlighted?: boolean;
}

interface Feature {
  name: string;
  tiers: {
    openSource: boolean;
    diy: boolean;
    autopilot: boolean;
  };
}

export const PricingTable: Component = () => {
  const tiers: PricingTier[] = [
    {
      name: "Open Source",
      price: "Free",
      forWho: "For early adopters and hobbyists who live life on the edge",
      features: [],
      ctaText: "Get Started",
      ctaLink: "/docs/edge/guides/getting-started/overview",
    },
    {
      name: "DIY",
      price: "$499 / cluster",
      forWho: "For cloud experts who want stability and love DIY",
      features: [],
      ctaText: "Purchase",
      ctaLink: "/contact", // TODO: Update with actual purchase link
    },
    {
      name: "Autopilot",
      price: "Contact Us",
      forWho:
        "For ambitious teams who want Panfactum infrastructure that Just Works™",
      features: [],
      ctaText: "Learn More",
      ctaLink: "/autopilot",
    },
  ];

  const features: Feature[] = [
    {
      name: "Edge Releases",
      tiers: { openSource: true, diy: true, autopilot: true },
    },
    {
      name: "Stable / LTS Releases",
      tiers: { openSource: false, diy: true, autopilot: true },
    },
    {
      name: "Prioritized GitHub Issues",
      tiers: { openSource: false, diy: true, autopilot: true },
    },
    {
      name: "Private Discord Channel",
      tiers: { openSource: false, diy: true, autopilot: true },
    },
    {
      name: "Guaranteed Cost Savings",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
    {
      name: "Dedicated Expert",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
    {
      name: "Whiteglove Setup",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
    {
      name: "Zero-downtime Migration",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
    {
      name: "Unlimited Support and Training",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
    {
      name: "Audit Assistance",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
    {
      name: "24/7 On-call Support",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
    {
      name: "IM Integration",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
    {
      name: "Volume Discounts",
      tiers: { openSource: false, diy: false, autopilot: true },
    },
  ];

  return (
    <>
      {/* Mobile layout - stacked cards */}
      <div
        class={`
          block space-y-6
          lg:hidden
        `}
      >
        <For each={tiers}>
          {(tier, tierIndex) => {
            // Get features for this tier
            const tierFeatures = features.filter((feature) =>
              tier.name === "Open Source"
                ? feature.tiers.openSource
                : tier.name === "DIY"
                  ? feature.tiers.diy
                  : feature.tiers.autopilot,
            );

            // Get unique features (not in previous tiers)
            const uniqueFeatures = createMemo(() => {
              const index = tierIndex();
              return index === 0
                ? tierFeatures
                : index === 1
                  ? tierFeatures.filter((f) => !f.tiers.openSource)
                  : tierFeatures.filter(
                      (f) => !f.tiers.openSource && !f.tiers.diy,
                    );
            });

            return (
              <div class="rounded-lg border border-secondary bg-secondary p-6">
                {/* Card header */}
                <div class="mb-6 text-center">
                  <h3 class="mb-4 text-display-sm font-bold">{tier.name}</h3>
                  <div class="mb-2 font-mono text-2xl">{tier.price}</div>
                  <div class="mb-6 text-sm text-secondary">{tier.forWho}</div>
                  <a
                    href={tier.ctaLink}
                    class={`
                      inline-block w-full rounded-md bg-brand-500 px-6 py-3
                      font-semibold text-white transition-colors
                      hover:bg-brand-600
                    `}
                  >
                    {tier.ctaText}
                  </a>
                </div>

                {/* Features list */}
                <div class="space-y-3">
                  {tierIndex() > 0 && (
                    <div class="mb-2 text-sm font-semibold text-brand-500">
                      Everything in {tierIndex() === 1 ? "Open Source" : "DIY"},
                      plus:
                    </div>
                  )}
                  <For
                    each={tierIndex() === 0 ? tierFeatures : uniqueFeatures()}
                  >
                    {(feature) => (
                      <div class="flex items-center gap-3 text-sm">
                        <span
                          class={`
                            inline-flex h-5 w-5 flex-shrink-0 items-center
                            justify-center rounded-full bg-brand-500
                          `}
                        >
                          <span class="text-xs text-white">✓</span>
                        </span>
                        <span>{feature.name}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Desktop layout - table */}
      <div
        class={`
          hidden overflow-x-auto
          lg:block
        `}
      >
        <div class="inline-flex min-w-full">
          {/* Feature names column */}
          <div class="w-1/4 flex-shrink-0">
            <div class="mb-8 h-60 p-4">{/* Empty header space */}</div>
            <For each={features}>
              {(feature, index) => (
                <div
                  class={`
                    flex h-16 items-center border-b border-l border-secondary
                    p-4
                    ${index() === 0 ? "rounded-tl-lg border-t" : "border-t"}
                    ${index() === features.length - 1 ? "rounded-bl-lg" : ""}
                  `}
                >
                  {feature.name}
                </div>
              )}
            </For>
          </div>

          {/* Pricing columns */}
          <For each={tiers}>
            {(tier, index) => (
              <div class="w-1/4 flex-shrink-0">
                {/* Header */}
                <div class="mb-8 flex h-60 flex-col p-4 text-center">
                  <h3 class="mb-4 text-display-md font-bold">{tier.name}</h3>
                  <div class="mb-2 font-mono text-xl">{tier.price}</div>
                  <div class="mb-auto text-sm text-secondary">
                    {tier.forWho}
                  </div>
                  <a
                    href={tier.ctaLink}
                    class={`
                      mt-4 inline-block rounded-md bg-brand-500 px-6 py-3
                      font-semibold text-white transition-colors
                      hover:bg-brand-600
                    `}
                  >
                    {tier.ctaText}
                  </a>
                </div>

                {/* Feature cells */}
                <div class="relative">
                  <For each={features}>
                    {(feature, featureIndex) => (
                      <div
                        class={`
                          flex h-16 items-center justify-center border
                          border-secondary p-4
                          ${featureIndex() === 0 ? "border-t" : "border-t-0"}
                          ${
                            featureIndex() === 0 && index() === tiers.length - 1
                              ? "rounded-tr-lg"
                              : ""
                          }
                          ${
                            featureIndex() === features.length - 1 &&
                            index() === tiers.length - 1
                              ? "rounded-br-lg"
                              : ""
                          }
                        `}
                      >
                        {(index() === 0
                          ? feature.tiers.openSource
                          : index() === 1
                            ? feature.tiers.diy
                            : feature.tiers.autopilot) && (
                          <span
                            class={`
                              inline-flex h-6 w-6 items-center justify-center
                              rounded-full bg-brand-500
                            `}
                          >
                            <span class="text-sm text-white">✓</span>
                          </span>
                        )}
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
};
