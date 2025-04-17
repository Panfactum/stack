import { Switch } from "@kobalte/core/switch";
import { clsx } from "clsx";
import { CgArrowsExpandRight } from "solid-icons/cg";
import { FiCalendar } from "solid-icons/fi";
import { HiOutlineRocketLaunch, HiOutlineArrowUpCircle } from "solid-icons/hi";
import { IoWarningOutline } from "solid-icons/io";
import {
  For,
  createEffect,
  createSignal,
  Switch as SolidSwitch,
  Match,
} from "solid-js";
import type { Component } from "solid-js";

import {
  Timeline as TimelineComponent,
  type TimelinePropsItem,
} from "./TimelineComponent";

const LAUNCH_WITH_PANFACTUM_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Launch development cluster in your AWS organization",
    description: "Setup your cluster with everything you need",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum-muted",
    time: "2 days",
  },
  {
    title: "Launch production cluster in your AWS organization",
    description: "Setup your cluster with everything you need",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum",
    time: "10 days",
  },
];

const LAUNCH_WITHOUT_PANFACTUM_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Launch development cluster in your AWS organization",
    description: "Setup your cluster with everything you need",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum-muted",
    time: "2 days",
  },
  {
    title: "Debugging",
    description: "Setup your cluster with everything you need",
    bullet: IoWarningOutline,
    type: "warning",
    time: "5 days",
  },
  {
    title: "Launch production cluster in your AWS organization",
    description: "Setup your cluster with everything you need",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum",
    time: "10 days",
  },
];

const EXPAND_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Determine your needs",
    description: "Setup your cluster with everything you need",
    bullet: IoWarningOutline,
    type: "warning",
    time: "2 days",
  },
  {
    title: "Choose your modules",
    description: "Setup your cluster with everything you need",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum-muted",
    time: "10 days",
  },
  {
    title: "Choose your workloads",
    description: "Setup your cluster with everything you need",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum",
  },
];

const UPGRADE_TIMELINE: TimelinePropsItem[] = [
  {
    title: "Read documentation",
    description: "Setup your cluster with everything you need",
    bullet: IoWarningOutline,
    type: "warning",
    time: "2 days",
  },
  {
    title: "Verify dependencies",
    description: "Setup your cluster with everything you need",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum-muted",
    time: "10 days",
  },
  {
    title: "Testing",
    description: "Setup your cluster with everything you need",
    bullet: HiOutlineRocketLaunch,
    type: "panfactum",
  },
];

interface LaunchOption {
  label: string;
  value: 1 | 2 | 3;
  icon: Component<{ class: string }>;
  timeline: {
    panfactumTotalTime: string;
    withoutPanfactumTotalTime: string;
    timelineItems: {
      panfactumTimeline: TimelinePropsItem[];
      withoutPanfactumTimeline: TimelinePropsItem[];
      buttons: {
        icon: Component<{ class: string }>;
        text: string;
        callbackValue: 2 | 1 | 3;
      }[];
    };
  };
  overview: {
    spend: string;
    items: {
      label: string;
      value: string;
    }[];
  };
}

const LaunchOptions: LaunchOption[] = [
  {
    label: "Launch",
    value: 1,
    icon: HiOutlineRocketLaunch,
    timeline: {
      panfactumTotalTime: "12 days",
      withoutPanfactumTotalTime: "20 days",
      timelineItems: {
        panfactumTimeline: LAUNCH_WITH_PANFACTUM_TIMELINE,
        withoutPanfactumTimeline: LAUNCH_WITHOUT_PANFACTUM_TIMELINE,
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
      spend: "$2.5-5K",
      items: [
        {
          label: "Modules",
          value: "3",
        },
        {
          label: "Databases",
          value: "2",
        },
        {
          label: "Workloads",
          value: "3",
        },
      ],
    },
  },
  {
    label: "Expand",
    value: 2,
    icon: CgArrowsExpandRight,
    timeline: {
      panfactumTotalTime: "5 days",
      withoutPanfactumTotalTime: "10 days",
      timelineItems: {
        panfactumTimeline: EXPAND_TIMELINE,
        withoutPanfactumTimeline: EXPAND_TIMELINE,
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
      spend: "$3K",
      items: [
        {
          label: "Modules",
          value: "3",
        },
      ],
    },
  },
  {
    label: "Upgrade",
    value: 3,
    icon: HiOutlineArrowUpCircle,
    timeline: {
      panfactumTotalTime: "5 days",
      withoutPanfactumTotalTime: "10 days",
      timelineItems: {
        panfactumTimeline: UPGRADE_TIMELINE,
        withoutPanfactumTimeline: UPGRADE_TIMELINE,
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
      spend: "$5K",
      items: [
        {
          label: "Modules",
          value: "3",
        },
        {
          label: "Workloads",
          value: "3",
        },
      ],
    },
  },
];

const tabItemClasses =
  "flex cursor-pointer items-center justify-center text-nowrap rounded py-2 font-semibold hover:bg-gold-300 hover:text-gray-light-mode-700 w-60";

const Timeline: Component = () => {
  const [planValue, setPlanValue] = createSignal<1 | 2 | 3>(1);
  const [plan, setPlan] = createSignal<LaunchOption>(LaunchOptions[0]);
  const [buildWithOurTeam, setBuildWithOurTeam] = createSignal(true);

  createEffect(() => {
    const selectedPlan = LaunchOptions.find((opt) => opt.value === planValue());
    if (selectedPlan) {
      setPlan(selectedPlan);
    }
  });

  return (
    <>
      <div class="flex grow flex-col gap-2">
        <div class="flex h-16 gap-4 rounded-md bg-gray-light-mode-800 p-3 shadow-md dark:bg-brand-800">
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
                      "ml-1",
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
      <div class="flex grow flex-col gap-2">
        <div class="mt-4 flex grow items-center justify-between">
          <div class="flex items-center">
            <FiCalendar class="mr-1 text-brand-300" />
            <SolidSwitch>
              <Match when={buildWithOurTeam()}>
                <div>
                  <span class="text-gray-light-mode-400 line-through">
                    {plan().timeline.withoutPanfactumTotalTime}
                  </span>{" "}
                  <span class="text-white">
                    {plan().timeline.panfactumTotalTime}
                  </span>
                </div>
              </Match>
              <Match when={!buildWithOurTeam()}>
                <div>
                  <span class="text-gold-300">
                    {plan().timeline.withoutPanfactumTotalTime}
                  </span>{" "}
                  <span class="italic text-white">
                    Save 60 Days with PanfactumPlus
                  </span>
                </div>
              </Match>
            </SolidSwitch>
          </div>
          <Switch
            class="inline-flex items-center gap-2"
            checked={buildWithOurTeam()}
            onChange={setBuildWithOurTeam}
          >
            <Switch.Input />
            <Switch.Control class="inline-flex h-6 w-12 items-center rounded-full bg-gray-light-mode-400 transition-all duration-200 ease-in-out data-[checked]:bg-gold-300 dark:bg-gray-dark-mode-100 dark:data-[checked]:bg-brand-300">
              <Switch.Thumb class="size-6 rounded-full bg-gray-dark-mode-200 ring-1 ring-inset ring-gray-dark-mode-400 transition-all duration-200 ease-in-out data-[checked]:translate-x-[calc(100%-1px)]" />
            </Switch.Control>
            <div class="flex items-center justify-between gap-4 text-white">
              <Switch.Label class={clsx("text-sm")}>
                Build with our team
              </Switch.Label>
            </div>
          </Switch>
        </div>
        <div class="mt-6 flex w-full min-w-[850px] gap-4">
          <div class="w-3/4">
            <TimelineComponent
              items={
                buildWithOurTeam()
                  ? plan().timeline.timelineItems.panfactumTimeline
                  : plan().timeline.timelineItems.withoutPanfactumTimeline
              }
              bulletSize={48}
              buttons={plan().timeline.timelineItems.buttons}
              buttonCallback={setPlanValue}
            />
          </div>
          <div class="w-1/4">
            <div class="flex flex-col gap-2 rounded bg-white p-4 text-sm text-gray-light-mode-600">
              <div class="flex justify-between">
                <span>SPEND</span>
                <span class="font-semibold text-brand-700">
                  {plan().overview.spend}
                </span>
              </div>
              <hr class="border-gray-light-mode-400" />
              <For each={plan().overview.items}>
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
