import * as Tabs from "@kobalte/core/tabs";
import { clsx } from "clsx";
import { For, type Component, createSignal } from "solid-js";

import panfactumMark from "@/components/icons/panfactum-mark.svg";

import contrastLogo from "./images/contrastai-logo.png";
import floraFaunaLogo from "./images/flora-fauna-logo.png";
import ikigaiLabsLogo from "./images/ikigai-labs-logo.png";
import luminescenceLogo from "./images/luminescense-logo.png";
import prometheusLogo from "./images/prometheus-logo.png";
import bootstrapHover from "./images/use-case-01-hover.png";
import bootstrap from "./images/use-case-01.png";
import seedHover from "./images/use-case-02-hover.png";
import seed from "./images/use-case-02.png";
import seriesAHover from "./images/use-case-03-hover.png";
import seriesA from "./images/use-case-03.png";
import seriesBHover from "./images/use-case-04-hover.png";
import seriesB from "./images/use-case-04.png";
import seriesCHover from "./images/use-case-05-hover.png";
import seriesC from "./images/use-case-05.png";

interface Plan {
  name: string;
  tagline: string;
  description: string;
  metrics: {
    awsSpend: string;
    launchTime: number | null;
    engHoursSaved: number | null;
    infrastructureSaved: number | null;
    totalSaved: number | null;
  };
  company: {
    logo: ImageMetadata;
    name: string;
  };
  image: {
    base: ImageMetadata;
    hover: ImageMetadata;
    baseTitles: string[];
    hoverPanfactumTitles: string[];
  };
}

interface MetricValueProps {
  value: string | number | null;
  suffix?: string;
  formatAsCurrency?: boolean;
}

const MetricValue: Component<MetricValueProps> = (props) => {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K / mo`;
    }
    return `$${amount} / mo`;
  };

  const formattedValue = () => {
    // Handle null values
    if (props.value === null) {
      return "Contact Us";
    }

    // Handle percentage formatting for numbers < 1
    if (typeof props.value === "number" && props.value < 1 && props.value > 0) {
      return `${(props.value * 100).toFixed(0)}%`;
    }

    // Handle currency formatting
    if (props.formatAsCurrency && typeof props.value === "number") {
      return formatCurrency(props.value);
    }

    // Default formatting
    return `${props.value}${props.suffix ?? ""}`;
  };

  return <span class=" font-medium text-brand-600">{formattedValue()}</span>;
};

const plans: Plan[] = [
  {
    name: "Bootstrapped",
    tagline: "Get to launch day with real infrastructure—no cloud headaches.",
    description:
      "When every dollar matters and every hour counts, we give you a fully production-ready platform out-of-the-box—backed by expert help, automated tooling, and zero fluff. Focus on building your product, we'll manage the infrastructure.",
    metrics: {
      awsSpend: "$0-2.5K / mo",
      launchTime: 4.5,
      engHoursSaved: 68,
      infrastructureSaved: 1200,
      totalSaved: 8000,
    },
    company: {
      name: "ContrastAI",
      logo: contrastLogo,
    },
    image: {
      base: bootstrap,
      hover: bootstrapHover,
      baseTitles: ["Founder"],
      hoverPanfactumTitles: ["Platform Engineer"],
    },
  },
  {
    name: "Seed",
    tagline: "Move fast, stay lean, and impress your first customers.",
    description:
      "You need reliability without bloated overhead. We give you managed Kuberentes, autoscaling, cost optimization, and a dedicated engineer so that you can onboard users confidently without worrying about downtime or DevOps hiring.",

    metrics: {
      awsSpend: "$2.5-5K / mo",
      launchTime: 9,
      engHoursSaved: 124,
      infrastructureSaved: 3800,
      totalSaved: 16200,
    },
    company: {
      name: "Ikigai Labs",
      logo: ikigaiLabsLogo,
    },
    image: {
      base: seed,
      hover: seedHover,
      baseTitles: ["Co-founder", "Co-founder"],
      hoverPanfactumTitles: ["Platform Engineer"],
    },
  },
  {
    name: "Series A",
    tagline: "Ready for growth, built to scale.",
    description:
      "The flywheel is turning and nothing is more important than maintaining your momentum. We help you shed the limits of your MVP systems without disruption by installing compliance-friendly defaults, multi-env deployments, and proactive monitoring.",

    metrics: {
      awsSpend: "$5-10K / mo",
      launchTime: 14,
      engHoursSaved: 189,
      infrastructureSaved: 11500,
      totalSaved: 28900,
    },
    company: {
      name: "Luminescence",
      logo: luminescenceLogo,
    },
    image: {
      base: seriesA,
      hover: seriesAHover,
      baseTitles: ["CEO", "VP Engineering"],
      hoverPanfactumTitles: ["Platform Engineer"],
    },
  },
  {
    name: "Series B",
    tagline: "Free your engineers to focus on what makes your product great.",
    description:
      "You've outgrown homegrown infrastructure. Panfactum takes full ownership of upgrades, environment parity, and incident triage—so your platform team can invest in performance, relaibiltiy, and customer-facing improvements.",

    metrics: {
      awsSpend: "$10-50K / mo",
      launchTime: 19,
      engHoursSaved: 276,
      infrastructureSaved: 19500,
      totalSaved: 46100,
    },
    company: {
      name: "Flora&Fauna",
      logo: floraFaunaLogo,
    },
    image: {
      base: seriesB,
      hover: seriesBHover,
      baseTitles: ["CTO", "VP Engineering", "Staff Engineer"],
      hoverPanfactumTitles: ["Platform Engineer"],
    },
  },
  {
    name: "Series C+",
    tagline:
      "Enterprise-grade infrastructure. Without the enterprise-grade bloat.",
    description:
      "As your company scales, so does the complexity. We deliver enterprise-grade reliabiltiy—global scale, mult-team collaboration, fine-grained cost controls—all while maintaing the same velocity that help you reach your current success.",
    metrics: {
      awsSpend: "$50K+ / mo",
      launchTime: null,
      engHoursSaved: 0.18,
      infrastructureSaved: 0.73,
      totalSaved: null,
    },
    company: {
      name: "Prometheus",
      logo: prometheusLogo,
    },
    image: {
      base: seriesC,
      hover: seriesCHover,
      baseTitles: [
        "CTO",
        "VP Engineering",
        "Staff Engineer",
        "Engineering Manager",
      ],
      hoverPanfactumTitles: ["Cloud Architect", "Platform Engineer"],
    },
  },
];

export const PlanSwitcher: Component = () => {
  const [hovering, setHovering] = createSignal(false);

  return (
    <Tabs.Root class="mx-auto w-full max-w-screen-2xl overflow-hidden pb-4">
      <Tabs.List
        class="no-scrollbar relative mb-12 flex overflow-x-scroll border-b border-gray-dark-mode-300 sm:justify-center"
        aria-label="Select your company stage"
      >
        <For each={plans}>
          {(plan) => (
            <Tabs.Trigger
              value={plan.name}
              class={clsx(
                "shrink-0 cursor-pointer text-nowrap px-6 py-2 text-center font-semibold text-gray-dark-mode-600 outline-none transition-colors sm:flex-1",
                "data-[selected]:font-bold data-[selected]:text-brand-700",
                "data-[selected=false]:text-gray-dark-mode-600 hover:data-[selected=false]:text-gray-dark-mode-800",
              )}
            >
              {plan.name}
            </Tabs.Trigger>
          )}
        </For>
        <Tabs.Indicator class="absolute bottom-0 left-0 z-10 h-[2px] bg-brand-700 transition-all duration-300" />
      </Tabs.List>

      <div class="relative">
        <For each={plans}>
          {(plan) => (
            <Tabs.Content value={plan.name}>
              <div class="mx-auto grid max-w-[80vw] grid-cols-1 items-center gap-12 lg:grid-cols-2 2xl:max-w-screen-xl">
                <div class="space-y-8">
                  <div>
                    <h3 class="mb-4 font-machina text-3xl font-medium">
                      {plan.name}
                    </h3>
                    <p class="mb-4 font-semibold text-brand-600">
                      {plan.tagline}
                    </p>
                    <p class="text-gray-dark-mode-600">{plan.description}</p>
                  </div>

                  <div class="rounded-xl bg-gray-dark-mode-50 px-6 ring-1 ring-gray-modern-300">
                    <div
                      class={clsx(
                        "flex items-center justify-between border-b border-gray-modern-300 py-4",
                      )}
                    >
                      <span class="font-semibold text-gray-dark-mode-700">
                        AWS Spend
                      </span>
                      <MetricValue value={plan.metrics.awsSpend} />
                    </div>
                    <div class="flex items-center justify-between py-2 pt-4">
                      <span class="text-gray-dark-mode-700">Launch Time</span>
                      <MetricValue
                        value={plan.metrics.launchTime}
                        suffix=" days"
                      />
                    </div>
                    <div class="flex items-center justify-between py-2">
                      <span class="text-gray-dark-mode-700">
                        Eng Hours Saved
                      </span>
                      <MetricValue
                        value={plan.metrics.engHoursSaved}
                        suffix=" / mo"
                      />
                    </div>
                    <div class="flex items-center justify-between py-2">
                      <span class="text-gray-dark-mode-700">
                        Infrastructure $ Saved
                      </span>
                      <MetricValue
                        value={plan.metrics.infrastructureSaved}
                        formatAsCurrency
                      />
                    </div>
                    <div
                      class={clsx(
                        "-mx-6 mt-2 flex items-center justify-between rounded-b-xl border-t border-gray-modern-300 bg-gray-dark-mode-200 p-4 px-6",
                      )}
                    >
                      <span class="text-gray-dark-mode-700">Total $ Saved</span>
                      <MetricValue
                        value={plan.metrics.totalSaved}
                        formatAsCurrency
                      />
                    </div>
                  </div>
                </div>

                <div class="flex max-w-md flex-col">
                  <div class="relative rounded-3xl rounded-b-none bg-[#FFF5EB]">
                    <div class="flex size-[425px] max-w-full justify-center overflow-visible">
                      <img
                        src={plan.image.base.src}
                        alt={`${plan.image.baseTitles.map((title, idx) => title + (idx === plan.image.baseTitles.length - 1 ? " collaborating" : " and")).join(" ")}`}
                        class="absolute size-full w-auto max-w-none object-cover object-top"
                        style={{
                          "max-width": "none",
                          left: "50%",
                          transform: "translateX(-50%)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.src = plan.image.hover.src;
                          setHovering(true);
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.src = plan.image.base.src;
                          setHovering(false);
                        }}
                      />
                    </div>
                  </div>

                  <div class="relative z-10 -my-5 mx-auto flex h-10 items-center justify-center rounded-full border border-gray-dark-mode-300 bg-[#ffffff]">
                    <span class="flex items-center px-6 text-sm font-bold text-gray-light-mode-950">
                      <img
                        src={plan.company.logo.src}
                        alt={plan.company.name + " Logo"}
                        class="mr-1 h-4"
                      />
                      {plan.company.name}
                    </span>
                  </div>

                  <div class="flex w-full max-w-md flex-wrap items-center justify-center gap-3 rounded-3xl rounded-t-none border border-gray-dark-mode-300 px-8 py-6">
                    <For each={plan.image.baseTitles}>
                      {(title) => (
                        <span class="font-medium text-gray-light-mode-600">
                          {title}
                        </span>
                      )}
                    </For>
                    {hovering() && (
                      <For each={plan.image.hoverPanfactumTitles}>
                        {(title) => (
                          <span class="flex items-center gap-2 font-medium text-brand-600">
                            <img
                              src={panfactumMark.src}
                              alt="Panfactum Logo"
                              class="size-4"
                              style={{
                                filter:
                                  "invert(30%) sepia(16%) saturate(1686%) hue-rotate(165deg) brightness(94%) contrast(87%)",
                              }}
                            />
                            {title}
                          </span>
                        )}
                      </For>
                    )}
                  </div>
                </div>
              </div>
            </Tabs.Content>
          )}
        </For>
      </div>
    </Tabs.Root>
  );
};
