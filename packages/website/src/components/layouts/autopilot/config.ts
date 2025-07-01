// Autopilot-specific navigation configuration
import PanfactumMark from "@/components/icons/panfactum-mark.svg?url";
import type { SecondTierConfig } from "@/components/layouts/common/types";

export const AUTOPILOT_SECOND_TIER_CONFIG: SecondTierConfig = {
  logo: {
    src: PanfactumMark,
    alt: "Panfactum Autopilot",
    href: "/autopilot",
  },
  links: [
    {
      title: "Overview",
      url: "/autopilot",
    },
    {
      title: "Features",
      url: "/autopilot/features",
    },
    {
      title: "Pricing",
      url: "/autopilot/pricing",
    },
    {
      title: "Get Started",
      url: "/autopilot/get-started",
    },
  ],
};