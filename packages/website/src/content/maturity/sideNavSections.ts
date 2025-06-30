

import {
  NavIcons,
  type TopLevelDocsSectionMetadata,
} from "@/components/layouts/docs/types";

export const SIDENAV_SECTIONS: TopLevelDocsSectionMetadata[] = [
  {
    text: "Maturity Model",
    path: "/maturity",
    icon: NavIcons.dataFlow,
    sub: [
      {
        text: "Overview",
        path: "/"
      },
      {
        text: "Measures",
        path: "/measures",
        sub: [
          {
            text: "KPIs",
            path: "/kpis",
          },
          {
            text: "Downtime Visibility",
            path: "/downtime-visibility",
          },
          {
            text: "Security Backlog",
            path: "/security-backlog",
          },
        ],
      },
      {
        text: "Pillars",
        path: "/pillars",
        sub: [
          {
            text: "Automation",
            path: "/automation",
          },
          {
            text: "Observability",
            path: "/observability",
          },
          {
            text: "Security",
            path: "/security",
          },
          {
            text: "Resiliency",
            path: "/resiliency",
          },
          {
            text: "Performance",
            path: "/performance",
          },
          {
            text: "Immediate Integration",
            path: "/immediate-integration",
          },
          {
            text: "Efficiency",
            path: "/efficiency",
          },
          {
            text: "Coordination",
            path: "/coordination",
          },
        ],
      },
    ],
  },
];
