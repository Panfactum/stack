// Tab bar for stable channel pages that switches between Summary, Upgrade Instructions, and Release List.
// Uses Kobalte Tabs and toggles visibility of sibling [data-tab] elements via DOM manipulation.

import { Tabs } from "@kobalte/core/tabs";
import { clsx } from "clsx";
import { Show, type Component } from "solid-js";

type ChannelTab = "summary" | "upgrade" | "releases";

interface IChannelTabBarProps {
  initialTab: ChannelTab;
  summaryUrl: string;
  upgradeUrl: string;
  releasesUrl: string;
  hasUpgradeInstructions: boolean;
}

const TAB_URL_MAP: Record<ChannelTab, keyof IChannelTabBarProps> = {
  summary: "summaryUrl",
  upgrade: "upgradeUrl",
  releases: "releasesUrl",
};

const showTab = (tabValue: string) => {
  const allPanels = document.querySelectorAll<HTMLElement>("[data-tab]");
  for (const panel of allPanels) {
    if (panel.dataset["tab"] === tabValue) {
      panel.classList.remove("hidden");
    } else {
      panel.classList.add("hidden");
    }
  }
};

const triggerClass = clsx(
  "cursor-pointer border-b-2 border-transparent px-4 py-2",
  "text-sm font-semibold text-secondary",
  "data-[selected]:border-brand-500 data-[selected]:text-primary",
);

export const ChannelTabBar: Component<IChannelTabBarProps> = (props) => {
  const handleTabChange = (value: string) => {
    showTab(value);
    const urlKey = TAB_URL_MAP[value as ChannelTab];
    const url = props[urlKey];
    window.history.replaceState(null, "", url as string);
  };

  return (
    <Tabs defaultValue={props.initialTab} onChange={handleTabChange}>
      <Tabs.List class="flex border-b border-primary">
        <Tabs.Trigger value="summary" class={triggerClass}>
          Summary
        </Tabs.Trigger>
        <Show when={props.hasUpgradeInstructions}>
          <Tabs.Trigger value="upgrade" class={triggerClass}>
            Upgrade Instructions
          </Tabs.Trigger>
        </Show>
        <Tabs.Trigger value="releases" class={triggerClass}>
          Release List
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
};
