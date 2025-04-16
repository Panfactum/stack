import { Switch } from "@kobalte/core/switch";
import { clsx } from "clsx";
import { CgArrowsExpandRight } from "solid-icons/cg";
import { FiCalendar } from "solid-icons/fi";
import { HiOutlineRocketLaunch, HiOutlineArrowUpCircle } from "solid-icons/hi";
import { IoWarningOutline } from "solid-icons/io";
import { For, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Timeline as TimelineComponent } from "./TimelineComponent";

const LaunchOptions = [
  { label: "Launch", value: 1, icon: HiOutlineRocketLaunch },
  { label: "Expand", value: 2, icon: CgArrowsExpandRight },
  { label: "Upgrade", value: 3, icon: HiOutlineArrowUpCircle },
];

const tabItemClasses =
  "flex cursor-pointer items-center justify-center text-nowrap rounded py-2 font-semibold text-white hover:bg-gold-300 hover:text-gray-light-mode-700 w-60";

const Timeline: Component = () => {
  const [plan, setPlan] = createSignal<(typeof LaunchOptions)[number]["value"]>(
    LaunchOptions[0].value,
  );
  const [buildWithOurTeam, setBuildWithOurTeam] = createSignal(false);

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
                    plan() === option.value &&
                      "bg-gold-300 text-gray-light-mode-700",
                  )}
                  onClick={() => {
                    setPlan(option.value);
                  }}
                >
                  {option.label}{" "}
                  <IconComponent
                    class={clsx(
                      "ml-1",
                      plan() !== option.value && "text-gold-300",
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
            {buildWithOurTeam() ? (
              <div>
                <span class="text-gray-light-mode-400 line-through">
                  90 Days
                </span>{" "}
                <span class="text-white">30 Days</span>
              </div>
            ) : (
              <div>
                <span class="text-gold-300">90 Days</span>{" "}
                <span class="italic text-white">
                  Save 60 Days with PanfactumPlus
                </span>
              </div>
            )}
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
              items={[
                {
                  title: "Launch development cluster in your AWS organization",
                  description: "Setup your cluster with everything you need",
                  bullet: <IoWarningOutline size={24} class="text-white" />,
                  type: "warning",
                  time: "2 days",
                },
                {
                  title: "Launch development cluster in your AWS organization",
                  description: "Setup your cluster with everything you need",
                  bullet: (
                    <HiOutlineRocketLaunch size={24} class="text-white" />
                  ),
                  type: "panfactum-muted",
                  time: "10 days",
                },
                {
                  title: "Launch development cluster in your AWS organization",
                  description: "Setup your cluster with everything you need",
                  bullet: (
                    <HiOutlineRocketLaunch size={24} class="text-white" />
                  ),
                  type: "panfactum",
                },
              ]}
              bulletSize={48}
            />
          </div>
          <div class="w-1/4">
            <div class="flex flex-col gap-2 rounded bg-white p-4 text-sm text-gray-light-mode-600">
              <div class="flex justify-between">
                <span>SPEND</span>
                <span class="font-semibold text-brand-700">$2.5-5K</span>
              </div>
              <hr class="border-gray-light-mode-400" />
              <div class="flex justify-between">
                <span>MODULES</span>
                <span>3</span>
              </div>
              <div class="flex justify-between">
                <span>DATABASES</span>
                <span>2</span>
              </div>
              <div class="flex justify-between">
                <span>WORKLOADS</span>
                <span>3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Timeline;
