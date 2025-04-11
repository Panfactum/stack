import { Accordion } from "@kobalte/core/accordion";
import { FiPlusCircle } from "solid-icons/fi";
import type { Component, ParentComponent } from "solid-js";

export const HowSectionExpandables: Component = () => {
  return (
    <div class="w-full">
      <Accordion
        class="flex w-full max-w-screen-lg flex-col gap-5"
        collapsible={true}
      >
        <HowSectionExpandable title="Dedicated Team of Experts">
          This is some content
        </HowSectionExpandable>
        <HowSectionExpandable title="Total Platform Management">
          This is some content
        </HowSectionExpandable>
        <HowSectionExpandable title="24/7/365 Monitoring & Triaging" />
        <HowSectionExpandable title="Unlimited Platform Customizations" />
        <HowSectionExpandable title="On-demand Support and Trainings" />
        <HowSectionExpandable title="Zero-disruption Migration" />
      </Accordion>
    </div>
  );
};

const HowSectionExpandable: ParentComponent<{ title: string }> = (props) => {
  return (
    <Accordion.Item
      value={props.title}
      class="rounded-xl border-2 border-gray-dark-mode-300  px-4 py-2"
    >
      <Accordion.Header class="[&[data-expanded]_svg]:rotate-45">
        <Accordion.Trigger class="text-xl flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left font-semibold">
          {props.title}
          <FiPlusCircle size={32} class="text-brand-600 transition-all" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content class="text-display-xs flex animate-kobalte-collapsible-up flex-col gap-4 overflow-hidden text-gray-dark-mode-700 data-[expanded]:animate-kobalte-collapsible-down [&_a]:underline [&_a]:hover:cursor-pointer">
        {props.children}
      </Accordion.Content>
    </Accordion.Item>
  );
};
