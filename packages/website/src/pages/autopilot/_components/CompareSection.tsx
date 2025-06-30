// Comparison section component showcasing Panfactum vs alternatives
// Displays a comparison table highlighting Panfactum's advantages over Hire/Contract and Legacy Agency options
import { clsx } from "clsx";
import { type Component } from "solid-js";

import { ComparisonTable } from "./ComparisonTable";

// Comparison data structure interface
interface ComparisonItem {
  criterion: string;
  hireContract: string;
  legacyAgency: string;
  panfactum: string;
}

// Comparison data constants with all 11 criteria from reference image
const COMPARISON_DATA: ComparisonItem[] = [
  {
    criterion: "Dedicated Engineer",
    hireContract: "Yes",
    legacyAgency: "No",
    panfactum: "Yes (+ Experts)",
  },
  {
    criterion: "Cost",
    hireContract: "$205K+ / year",
    legacyAgency: "Hidden, highly variable",
    panfactum: "Starting at $999 / month",
  },
  {
    criterion: "Time to Launch",
    hireContract: "3-12 months",
    legacyAgency: "3-12 months",
    panfactum: "Days",
  },
  {
    criterion: "Quality",
    hireContract: "Unproven",
    legacyAgency: "Unproven",
    panfactum: "1,000's of users",
  },
  {
    criterion: "Initial Commitment",
    hireContract: "High",
    legacyAgency: "Medium",
    panfactum: "45-day refund period",
  },
  {
    criterion: "24/7/365 Monitoring",
    hireContract: "No",
    legacyAgency: "No",
    panfactum: "Yes",
  },
  {
    criterion: "Maintenance",
    hireContract: "100% up to you",
    legacyAgency: "Extra costs",
    panfactum: "Automatic",
  },
  {
    criterion: "Extensibility",
    hireContract: "100% up to you",
    legacyAgency: "Proprietary, rigid",
    panfactum: "Extensible, open-source",
  },
  {
    criterion: "Documentation",
    hireContract: "100% up to you",
    legacyAgency: "None / Limited",
    panfactum: "100's of pages",
  },
  {
    criterion: "Audit / Compliance",
    hireContract: "100% up to you",
    legacyAgency: "None / Extra costs",
    panfactum: "SOC 2, HITRUST, etc.",
  },
  {
    criterion: "Spend Reduction",
    hireContract: "None",
    legacyAgency: "None / Limited",
    panfactum: "Guaranteed savings",
  },
];

export const CompareSection: Component = () => {
  return (
    <section
      class={clsx(
        "mx-auto max-w-screen-2xl px-6 py-20",
        "md:px-10",
        "lg:px-16",
      )}
    >
      {/* Section header */}
      <div class="mb-16 text-center">
        <h2 class="mb-6 font-machina text-display-lg font-bold text-white">
          We Go Where Noone Else Can
        </h2>
        <p class="mx-auto max-w-4xl text-display-sm text-secondary">
          Your users don't settle for average. so why would you?
        </p>
      </div>

      {/* Comparison table */}
      <ComparisonTable data={COMPARISON_DATA} />
    </section>
  );
};
