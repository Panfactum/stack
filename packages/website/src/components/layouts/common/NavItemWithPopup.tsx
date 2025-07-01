// Navigation item component that can display either a simple link or a popup on hover
import { HoverCard } from "@kobalte/core/hover-card";
import type { Component } from "solid-js";
import { Show } from "solid-js";

import SavedLink from "@/components/util/SavedLink.tsx";

interface INavItemWithPopupProps {
  title: string;
  action: string | Component;
  class?: string;
  saveEnabled?: boolean;
}

export const NavItemWithPopup: Component<INavItemWithPopupProps> = (props) => {
  const linkClass =
    "mt-2 cursor-pointer bg-transparent text-display-xs font-bold hover:text-brand-600 dark:hover:text-secondary focus-visible:outline-none";

  return (
    <Show
      when={typeof props.action !== "string"}
      fallback={
        <SavedLink
          defaultHref={props.action as string}
          id={props.title}
          data-astro-prefetch="viewport"
          class={linkClass}
          saveEnabled={props.saveEnabled ?? true}
        >
          {props.title}
        </SavedLink>
      }
    >
      <HoverCard openDelay={50} closeDelay={100}>
        <HoverCard.Trigger class={linkClass}>{props.title}</HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            class={`
              z-20 mt-2 max-w-sm rounded-md border border-primary bg-primary p-4
              shadow-lg transition-all duration-200
              focus-visible:outline-none
              data-[closed]:scale-95 data-[closed]:opacity-0
              data-[expanded]:scale-100 data-[expanded]:opacity-100
            `}
          >
            <props.action />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard>
    </Show>
  );
};
