import { Switch } from "@kobalte/core/switch";
import { clsx } from "clsx";
import { CgArrowsExpandRight } from "solid-icons/cg";
import { FiCalendar } from "solid-icons/fi";
import {
  HiOutlineClipboard,
  HiOutlineRocketLaunch,
  HiOutlineArrowUpCircle,
  HiOutlineLockClosed,
  HiOutlineBellAlert,
} from "solid-icons/hi";
import { IoWarningOutline } from "solid-icons/io";
import { OcWorkflow3 } from "solid-icons/oc";
import { RiFinanceMoneyDollarCircleLine } from "solid-icons/ri";
import { SiKubernetes, SiTraefikmesh } from "solid-icons/si";
import { TbArrowBackUp, TbWriting } from "solid-icons/tb";
import { TiCloudStorageOutline } from "solid-icons/ti";
import {
  For,
  createEffect,
  createSignal,
  Switch as SolidSwitch,
  Match,
  createMemo,
} from "solid-js";
import type { Component } from "solid-js";

import {
  calculatorStore,
  PlanOptions,
} from "@/pages/plus/pricing/_components/PricingSection/calculatorStore";

import {
  Timeline as TimelineComponent,
  type TimelinePropsItem,
} from "./TimelineComponent";

const LAUNCH_WITH_PANFACTUM_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Initial infrastructure planning",
    description:
      "Continuously researched and tested Panfactum framework to ensure it's the best fit for your needs.",
    bullet: "panfactum",
    type: "panfactum",
    time: "0 days",
  },
  {
    title: "Kubernetes Cluster Setup",
    description:
      "Deploying the Panfactum battle-tested Kubernetes cluster with all the necessary tools and configurations.",
    bullet: "panfactum",
    type: "panfactum",
    time: "0.5 days",
  },
  {
    title: "Basic CI/CD Pipeline Implementation",
    description:
      "Custom setup of all the necessary tools and configurations for a CI/CD pipeline that is ready to deploy your application.",
    bullet: "panfactum",
    type: "panfactum",
    time: "1 days",
  },
  {
    title: "Security Baseline Implementation",
    description:
      "Tuning the best practice hardened security tooling of the Panfactum framework to ensure your application is secure and your engineers are productive.",
    bullet: "panfactum",
    type: "panfactum",
    time: "0.5 days",
  },
  {
    title: "Monitoring and Alerting Setup",
    description:
      "Custom implementation of monitoring and alerting tools to monitor the cluster and alert on the most critical issues relevant to your business and application.",
    bullet: "panfactum",
    type: "panfactum",
    time: "1 days",
  },
];

const LAUNCH_WITHOUT_PANFACTUM_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Initial infrastructure planning",
    description:
      "Researching open-source tools that meet budget constraints while providing essential functionality, often requiring compromises between features and resource consumption. Documenting minimal viable infrastructure that balances cost-efficiency with reliability, leading to difficult prioritization decisions.",
    bullet: HiOutlineClipboard,
    type: "panfactum-muted",
    time: "5 days",
  },
  {
    title: "Kubernetes Cluster Setup",
    description: "Installing a basic EKS Kubernetes cluster.",
    bullet: SiKubernetes,
    type: "panfactum-muted",
    time: "2 days",
  },
  {
    title: "Kubernetes Cluster Troubleshooting",
    description:
      "Troubleshooting persistent networking issues between nodes caused by cloud provider limitations that aren't clearly documented in any knowledge base.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "5 days",
  },
  {
    title: "Basic CI/CD Pipeline Implementation",
    description:
      "Configuring simple pipelines to deploy the application code to the cluster.",
    bullet: OcWorkflow3,
    type: "panfactum-muted",
    time: "2 days",
  },
  {
    title: "CI/CD Pipeline Debugging",
    description:
      "Pipelines break due to undocumented dependencies or inconsistent environments between local development and CI systems. Spending hours debugging cryptic error messages from failing builds only to discover simple issues like missing environment variables or permissions.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "4 days",
  },
  {
    title: "Security Baseline Implementation",
    description:
      "Implementing basic security measures like firewalls, network policies, database access, RBAC, and dynamic credentials. Balancing security requirements with operational needs.",
    bullet: HiOutlineLockClosed,
    type: "panfactum-muted",
    time: "4 days",
  },
  {
    title: "Security Fine Tuning",
    description:
      "Security measures that frequently block legitimate traffic due to overly restrictive default configurations. Lacking proper testing environments to validate changes before production deployment.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "4 days",
  },
  {
    title: "Monitoring and Alerting Setup",
    description:
      "Deploying monitoring and alerting tools to monitor the cluster and alert on critical issues.",
    bullet: HiOutlineBellAlert,
    type: "panfactum-muted",
    time: "2 days",
  },
  {
    title: "Monitoring and Alerting Setup",
    description:
      "Monitoring tools consume unexpectedly high resources, causing performance issues on the already resource-constrained cluster. Alerts that either generate too many notifications (alert fatigue) or miss critical issues due to inappropriate thresholds based on limited historical data.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "5 days",
  },
];

const EXPAND_WITH_PANFACTUM_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Storage Solution Integration",
    description:
      "Enterprise-grade storage solution seamlessly integrated from day one with the Panfactum Framework, providing immediate scalability and reliability without additional configuration.",
    bullet: "panfactum",
    type: "panfactum",
    time: "0 days",
  },
  {
    title: "Logging Infrastructure",
    description:
      "Comprehensive, turn-key logging infrastructure pre-configured and immediately available from day one with the Panfactum Framework, eliminating setup complexity.",
    bullet: "panfactum",
    type: "panfactum",
    time: "0 days",
  },
  {
    title: "Service Mesh Implementation",
    description:
      "Sophisticated service mesh architecture pre-integrated into the Panfactum Framework, enabling secure service-to-service communication and advanced traffic management from the start.",
    bullet: "panfactum",
    type: "panfactum",
    time: "0 days",
  },
];

const EXPAND_WITHOUT_PANFACTUM_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Storage Solution Integration",
    description: "Implement persistent storage solution.",
    bullet: TiCloudStorageOutline,
    type: "panfactum-muted",
    time: "2 days",
  },
  {
    title: "Storage Solution Failures",
    description:
      "Persistent storage solutions that frequently fail during node rescheduling, causing data accessibility issues. Discovering that default storage classes don't meet performance requirements only after applications experience timeouts under load.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "4 days",
  },
  {
    title: "Logging Infrastructure",
    description:
      "Deploy logging stack and configure all applications to use it.",
    bullet: TbWriting,
    type: "panfactum-muted",
    time: "3 days",
  },
  {
    title: "Troubleshooting Logging",
    description:
      "Logging quickly fills available storage due to misconfigured retention policies or verbose application logging. Log collection agents that randomly stop working due to resource constraints or network connectivity issues between components.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "5 days",
  },
  {
    title: "Service Mesh Implementation",
    description:
      "Install a lightweight service mesh to add security and observability to your applications.",
    bullet: SiTraefikmesh,
    type: "panfactum-muted",
    time: "5 days",
  },
  {
    title: "Debugginb Service Mesh",
    description:
      "Service mesh adds unexpected latency to service communications and consumes more resources than anticipated. Debugging mysterious connection failures between services that occur intermittently due to TLS certificate issues or proxy sidecar configuration problems.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "7 days",
  },
];

const UPGRADE_WITH_PANFACTUM_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Scaling Improvements",
    description:
      "Seamlessly integrated horizontal, vertical, and dynamic autoscaling for nodes, pods, and containers that intelligently optimizes resource allocation with unparalleled efficiency and precision built into the Panfactum Framework.",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum-muted",
    time: "0 days",
  },
  {
    title: "Backup and Disaster Recovery",
    description:
      "Enterprise-grade backup and disaster recovery solutions, rigorously tested and seamlessly integrated into the Panfactum Framework, ensuring business continuity with zero additional configuration.",
    bullet: TbArrowBackUp,
    type: "panfactum-muted",
    time: "0 days",
  },
  {
    title: "Cost Optimization",
    description:
      "Infrastructure costs are automatically optimized through the intelligent scaling mechanisms built into the Panfactum Framework. The platform ensures maximum resource efficiency with dynamic allocation, spot instance utilization, and optimal cloud spending - delivering the most cost-effective infrastructure possible with zero additional configuration.",
    bullet: RiFinanceMoneyDollarCircleLine,
    type: "panfactum-muted",
    time: "0 days",
  },
];

const UPGRADE_WITHOUT_PANFACTUM_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Scaling Improvements",
    description:
      "Implementing autoscaling at the node, pod, and container level. Deploying a scheduler that improves resource usage dynamically.",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum-muted",
    time: "7 days",
  },
  {
    title: "Fixing Scaling Issues",
    description:
      "Autoscaling reacts too slowly to traffic spikes or scales up unnecessarily due to poorly configured metrics. Applications crash during scaling events because they weren't designed to handle connection pooling or state management properly.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "5 days",
  },
  {
    title: "Backup and Disaster Recovery",
    description: "Configuring backup systems and recovery procedures.",
    bullet: TbArrowBackUp,
    type: "panfactum-muted",
    time: "6 days",
  },

  {
    title: "Backup and Disaster Recovery Testing",
    description:
      "Backup systems complete successfully but create unusable restore points due to application-specific requirements not being met. Testing recovery procedures only to find they take significantly longer than expected, exceeding tolerable downtime windows.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "3 days",
  },
  {
    title: "Cost Optimization",
    description:
      "Optimizing infrastructure costs through resource quotas, leveraging spot instances for non-critical workloads, and negotiating long-term savings plan contracts.",
    bullet: RiFinanceMoneyDollarCircleLine,
    type: "panfactum-muted",
    time: "5 days",
  },
  {
    title: "Cost Optimization",
    description:
      "Resource quotas occasionally prevent critical system pods from scheduling during high utilization periods. Spot instances are unexpectedly terminated during important processing jobs, requiring complex handling of interruption events that wasn't initially planned.",
    bullet: IoWarningOutline,
    type: "warning",
    time: "7 days",
  },
];

// Generate type for plan values dynamically from PlanOptions
type PlanValue = (typeof PlanOptions)[number]["value"];

// Define common overview item types for better type safety
type OverviewItem = {
  label: string;
  value: number;
};

interface LaunchOption {
  label: string;
  value: 1 | 2 | 3;
  icon: Component<{ class: string }>;
  timeline: {
    panfactumTotalTime: number;
    withoutPanfactumTotalTime: number;
    timelineItems: {
      panfactumTimeline: {
        [key in PlanValue]: TimelinePropsItem[];
      };
      withoutPanfactumTimeline: {
        [key in PlanValue]: TimelinePropsItem[];
      };
      buttons: {
        icon: Component<{ class: string }>;
        text: string;
        callbackValue: 2 | 1 | 3;
      }[];
    };
  };
  overview: {
    items: OverviewItem[];
  };
}

// Function to generate overview items based on launch option and plan
const generateOverviewItems = (
  launchType: 1 | 2 | 3,
  planType: PlanValue,
): OverviewItem[] => {
  const plan = calculatorStore;
  switch (launchType) {
    case 1: // Launch
    case 3: // Upgrade
      switch (planType) {
        case 1:
          return [
            {
              label: "Modules",
              value: 5,
            },
            {
              label: "Databases",
              value: 1,
            },
            {
              label: "Workloads",
              value: 2,
            },
          ];
        case 2:
          return [
            {
              label: "Modules",
              value: 10,
            },
            {
              label: "Databases",
              value: 2,
            },
            {
              label: "Workloads",
              value: 4,
            },
          ];
        case 3:
          return [
            {
              label: "Modules",
              value: 16,
            },
            {
              label: "Databases",
              value: 4,
            },
            {
              label: "Workloads",
              value: 10,
            },
          ];
        case 4:
          return [
            {
              label: "Modules",
              value: 25,
            },
            {
              label: "Databases",
              value: 10,
            },
            {
              label: "Workloads",
              value: 40,
            },
          ];
        default:
          return [
            {
              label: "Clusters",
              value: plan.clusterCount,
            },
            {
              label: "Modules",
              value: plan.moduleCount,
            },
            {
              label: "Databases",
              value: plan.dbCount,
            },
            {
              label: "Workloads",
              value: plan.workloadCount,
            },
          ];
      }

    case 2: // Expand
      switch (planType) {
        case 1:
          return [
            {
              label: "Additional Modules",
              value: 2,
            },
            {
              label: "Additional Databases",
              value: 1,
            },
            {
              label: "Additional Workloads",
              value: 2,
            },
          ];
        case 2:
          return [
            {
              label: "Additional Modules",
              value: 4,
            },
            {
              label: "Additional Databases",
              value: 1,
            },
            {
              label: "Additional Workloads",
              value: 3,
            },
          ];
        case 3:
          return [
            {
              label: "Additional Modules",
              value: 10,
            },
            {
              label: "Additional Databases",
              value: 2,
            },
            {
              label: "Additional Workloads",
              value: 5,
            },
          ];
        case 4:
          return [
            {
              label: "Additional Modules",
              value: 16,
            },
            {
              label: "Additional Databases",
              value: 4,
            },
            {
              label: "Additional Workloads",
              value: 10,
            },
          ];
        default:
          return [
            {
              label: "Additional Modules",
              value: plan.moduleCount,
            },
            {
              label: "Additional Databases",
              value: plan.dbCount,
            },
            {
              label: "Additional Workloads",
              value: plan.workloadCount,
            },
          ];
      }

    default:
      return [
        {
          label: "Clusters",
          value: plan.clusterCount,
        },
      ];
  }
};

const createPlanTimelines = <T extends TimelinePropsItem[]>(items: T) => {
  return PlanOptions.reduce(
    (acc, option) => {
      acc[option.value] = items;
      return acc;
    },
    {} as Record<PlanValue, T>,
  );
};

const LaunchOptions: LaunchOption[] = [
  {
    label: "Launch",
    value: 1,
    icon: HiOutlineRocketLaunch,
    timeline: {
      panfactumTotalTime: 3,
      withoutPanfactumTotalTime: 33,
      timelineItems: {
        panfactumTimeline: createPlanTimelines(LAUNCH_WITH_PANFACTUM_TIMELINE),
        withoutPanfactumTimeline: createPlanTimelines(
          LAUNCH_WITHOUT_PANFACTUM_TIMELINE,
        ),
        buttons: [
          {
            icon: CgArrowsExpandRight,
            text: "Expand",
            callbackValue: 2,
          },
          {
            icon: HiOutlineArrowUpCircle,
            text: "Upgrade",
            callbackValue: 3,
          },
        ],
      },
    },
    overview: {
      items: generateOverviewItems(1, calculatorStore.plan),
    },
  },
  {
    label: "Expand",
    value: 2,
    icon: CgArrowsExpandRight,
    timeline: {
      panfactumTotalTime: 0,
      withoutPanfactumTotalTime: 26,
      timelineItems: {
        panfactumTimeline: createPlanTimelines(EXPAND_WITH_PANFACTUM_TIMELINE),
        withoutPanfactumTimeline: createPlanTimelines(
          EXPAND_WITHOUT_PANFACTUM_TIMELINE,
        ),
        buttons: [
          {
            icon: HiOutlineRocketLaunch,
            text: "Launch",
            callbackValue: 1,
          },
          {
            icon: HiOutlineArrowUpCircle,
            text: "Upgrade",
            callbackValue: 3,
          },
        ],
      },
    },
    overview: {
      items: generateOverviewItems(2, calculatorStore.plan),
    },
  },
  {
    label: "Upgrade",
    value: 3,
    icon: HiOutlineArrowUpCircle,
    timeline: {
      panfactumTotalTime: 0,
      withoutPanfactumTotalTime: 29,
      timelineItems: {
        panfactumTimeline: createPlanTimelines(UPGRADE_WITH_PANFACTUM_TIMELINE),
        withoutPanfactumTimeline: createPlanTimelines(
          UPGRADE_WITHOUT_PANFACTUM_TIMELINE,
        ),
        buttons: [
          {
            icon: HiOutlineRocketLaunch,
            text: "Launch",
            callbackValue: 1,
          },
          {
            icon: CgArrowsExpandRight,
            text: "Expand",
            callbackValue: 2,
          },
        ],
      },
    },
    overview: {
      items: generateOverviewItems(3, calculatorStore.plan),
    },
  },
];

const tabItemClasses =
  "flex grow cursor-pointer items-center justify-center text-nowrap rounded py-2 font-semibold hover:bg-gold-300 hover:text-gray-light-mode-700 md:w-60 text-xs md:text-base";

const Timeline: Component = () => {
  const [planValue, setPlanValue] = createSignal<1 | 2 | 3>(1);
  const [plan, setPlan] = createSignal<LaunchOption>(LaunchOptions[0]);
  const [buildWithPanfactumPlus, setBuildWithPanfactumPlus] =
    createSignal(true);

  const timelineItems = createMemo(() => {
    const currentPlan = calculatorStore.plan;
    return buildWithPanfactumPlus()
      ? plan().timeline.timelineItems.panfactumTimeline[currentPlan]
      : plan().timeline.timelineItems.withoutPanfactumTimeline[currentPlan];
  });

  // Add memo for overview items
  const overviewItems = createMemo(() => {
    const currentPlan = plan().value;
    return generateOverviewItems(currentPlan, calculatorStore.plan);
  });

  createEffect(() => {
    const selectedPlan = LaunchOptions.find((opt) => opt.value === planValue());
    if (selectedPlan) {
      setPlan(selectedPlan);
    }
  });

  return (
    <>
      <div class="flex w-full grow flex-col gap-2 px-2 sm:w-auto sm:px-4">
        <div class="flex h-16 gap-1 rounded-lg bg-gray-light-mode-800 p-2 shadow-md md:gap-4 md:p-3 dark:bg-gray-dark-mode-950">
          <For each={LaunchOptions}>
            {(option) => {
              const IconComponent = option.icon;
              return (
                <button
                  class={clsx(
                    tabItemClasses,
                    "group",
                    planValue() === option.value
                      ? "bg-gold-300 text-gray-light-mode-700"
                      : "text-white",
                  )}
                  onClick={() => {
                    setPlanValue(option.value);
                  }}
                >
                  {option.label}{" "}
                  <IconComponent
                    class={clsx(
                      "ml-1 text-sm md:text-base",
                      planValue() === option.value
                        ? "text-gray-light-mode-700"
                        : "text-gold-300",
                      "group-hover:text-gray-light-mode-700",
                    )}
                  />
                </button>
              );
            }}
          </For>
        </div>
      </div>
      <div class="flex max-w-[1025px] grow flex-col gap-2 px-2 sm:px-4 lg:w-4/6">
        <div class="mt-4 flex grow flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-0">
          <div class="flex items-center">
            <FiCalendar class="mr-1 text-brand-300" />
            <SolidSwitch>
              <Match when={buildWithPanfactumPlus()}>
                <div>
                  <span class="text-gray-light-mode-400 line-through">
                    {plan().timeline.withoutPanfactumTotalTime} days
                  </span>{" "}
                  <span class="text-white">
                    {plan().timeline.panfactumTotalTime} days
                  </span>
                </div>
              </Match>
              <Match when={!buildWithPanfactumPlus()}>
                <div>
                  <span class="text-gold-300">
                    {plan().timeline.withoutPanfactumTotalTime} days
                  </span>{" "}
                  <span class="italic text-white">
                    Save{" "}
                    {plan().timeline.withoutPanfactumTotalTime -
                      plan().timeline.panfactumTotalTime}{" "}
                    days with PanfactumPlus
                  </span>
                </div>
              </Match>
            </SolidSwitch>
          </div>
          <Switch
            class="inline-flex items-center gap-2"
            checked={buildWithPanfactumPlus()}
            onChange={setBuildWithPanfactumPlus}
          >
            <Switch.Input />
            <Switch.Control class="inline-flex h-6 w-12 items-center rounded-full bg-gray-light-mode-400 transition-all duration-200 ease-in-out data-[checked]:bg-gold-300">
              <Switch.Thumb class="size-6 rounded-full bg-gray-dark-mode-200 ring-1 ring-inset ring-gray-dark-mode-400 transition-all duration-200 ease-in-out data-[checked]:translate-x-[calc(100%-1px)]" />
            </Switch.Control>
            <div class="flex items-center justify-between gap-4 text-white">
              <Switch.Label class={clsx("text-sm")}>
                Build with PanfactumPlus
              </Switch.Label>
            </div>
          </Switch>
        </div>
        <div class="mt-6 flex w-full min-w-0 flex-col gap-4 lg:flex-row">
          <div class="w-full lg:w-3/4">
            <div class="max-w-full">
              <TimelineComponent
                items={timelineItems()}
                bulletSize={48}
                buttons={plan().timeline.timelineItems.buttons}
                buttonCallback={setPlanValue}
              />
            </div>
          </div>
          <div class="hidden w-full lg:block lg:w-1/4">
            <div class="flex flex-col gap-2 rounded-lg bg-white p-4 text-sm text-gray-light-mode-600 dark:bg-gray-dark-mode-600 dark:text-gray-dark-mode-50">
              <div class="flex justify-between">
                <span>AWS SPEND</span>
                <span class="font-semibold text-brand-700 dark:text-gold-300">
                  {
                    PlanOptions.find(
                      (opt) => opt.value === calculatorStore.plan,
                    )?.label
                  }
                </span>
              </div>
              <hr class="border-gray-light-mode-400 dark:border-gray-dark-mode-50" />
              <For each={overviewItems()}>
                {(item) => (
                  <div class="flex justify-between">
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Timeline;
