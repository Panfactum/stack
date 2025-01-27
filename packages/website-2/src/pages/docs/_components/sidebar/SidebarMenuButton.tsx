import { Collapsible } from "@kobalte/core/collapsible";
import { clsx } from "clsx";
import { FiChevronDown } from "solid-icons/fi";
import {Show, type Component } from "solid-js";

import SavedLink from "@/components/solid/util/SavedLink.tsx";
interface SidebarMenuButtonProps {
  isActive: boolean;
  text: string;
  expandable?: boolean;
  href?: string;
  class?: string;
  activeClass?: string;
  IconComponent?: Component;
  isChild?: boolean;
  saveUserLocation?: boolean; // Iff ture, the href will be replaced with the user's last visited page that is "inside" the href (e.g., '/docs' -> '/docs/a/b/c`)
}

const SidebarMenuButton: Component<SidebarMenuButtonProps> = (props) => {
  const buttonClasses = () =>
    clsx(
      "hover:bg-accent-light  min-h-[44px]",
      "flex w-full items-center gap-5 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-[width,height,padding]",
      "focus-visible:ring-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "[&>svg]:data-[expanded]:rotate-180",
      props.isActive && (props.activeClass || "bg-accent font-medium"),
      props.class,
    );

  return (
    <Show
      when={props.expandable}
      fallback={(
        <li class={clsx(props.isChild && "pl-4")}>
          <SavedLink
            defaultHref={props.href || "#"}
            id={`${props.text.toLowerCase()}`}
            saveEnabled={props.saveUserLocation}
          >
            <button class={buttonClasses()}>
              {props.IconComponent && (
                <span
                  class={clsx(
                    props.isActive && "text-brand-600 dark:text-brand-500",
                  )}
                >
                <props.IconComponent/>
              </span>
              )}
              <span class="truncate font-semibold">{props.text}</span>
            </button>
          </SavedLink>
        </li>
      )}
    >
      <li>
        <Collapsible.Trigger
          class={buttonClasses()}
          aria-selected={props.isActive}
        >
          <span class="truncate font-semibold">{props.text}</span>
          <FiChevronDown class={"ml-auto transition-transform"}/>
        </Collapsible.Trigger>
      </li>
    </Show>
  );
};

export default SidebarMenuButton;
