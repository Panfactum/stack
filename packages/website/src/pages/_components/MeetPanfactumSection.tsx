// Meet Panfactum section component displaying two product cards with placeholder image
// Shows PCNF and Autopilot offerings in a responsive grid layout
import { type Component } from "solid-js";

import { ProductCard } from "./ProductCard";

export const MeetPanfactumSection: Component = () => {
  const pcnfBullets = [
    "Save 90% with an open-source, self-hosted, Kubernetes platform",
    "Standardize on battle-tested patterns for any workload at any scale",
    "Unlock new capabilities with 100s of turn-key modules",
  ];

  const autopilotBullets = [
    "Guaranteed cost savings",
    "White-glove setup and migration",
    "On-call support and managed upgrades",
  ];

  return (
    <section class="relative bg-tertiary py-20">
      {/* Subtle radial gradient overlay */}
      <div
        class="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-brand-400) 10%, transparent) 0%, color-mix(in srgb, var(--color-brand-200) 8%, transparent) 30%, transparent 60%)",
        }}
      />

      <div
        class={`
          relative mx-auto max-w-screen-2xl px-6
          md:px-10
          lg:px-16
        `}
      >
        {/* Section header */}
        <div class="mb-16 text-center">
          <h2 class="mb-6 font-machina text-display-lg font-bold text-white">
            Try Panfactum
          </h2>
          <p class="mx-auto max-w-4xl text-display-sm text-secondary">
            Build the cloud environment that you've always wanted.
          </p>
        </div>

        {/* Product cards */}
        <div class="flex flex-col gap-6">
          <ProductCard
            title="Panfactum Cloud Native Framework (PCNF)"
            mobileTitle="Panfactum Framework"
            subtitle="Deploy, scale, and manage cloud workloads with a pre-built, extensible PaaS framework designed for the full SDLC"
            bullets={pcnfBullets}
            image="https://via.placeholder.com/400x300/ffffff/1f2937?text=PCNF+Features"
            ribbon="Open Source"
            href="/framework"
          />
          <ProductCard
            title="Panfactum Autopilot"
            subtitle="End-to-end management of our FOSS cloud framework by veteran platform engineers"
            bullets={autopilotBullets}
            image="https://via.placeholder.com/400x300/ffffff/1f2937?text=Autopilot+Features"
            ribbon="Managed Service"
            ribbonColor="bg-yellow-600"
            href="/autopilot"
          />
        </div>
      </div>
    </section>
  );
};
