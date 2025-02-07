import { Collapsible } from "@kobalte/core/collapsible";
import { clsx } from "clsx";
import { FiChevronDown } from "solid-icons/fi";
import {Show, type Component } from "solid-js";

import SavedLink from "@/components/util/SavedLink.tsx";
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
      "hover:bg-accent-light",
      props.IconComponent ? "h-[35px] max-h-[35px] min-h-[35px]" : "h-[30px] max-h-[30px] min-h-[30px]",
      "relative flex w-full max-w-full items-center overflow-x-visible text-ellipsis rounded-md p-2 pl-4 text-left text-sm outline-none transition-[width,height,padding]",
      "focus-visible:ring-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "[&>svg]:data-[expanded]:rotate-180",
      props.isActive ? (props.activeClass ?? "text-primary font-bold") : "text-secondary",
      props.class
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
              {props.isActive && <div class="absolute left-1 min-h-4/5 min-w-1 rounded-full bg-brand-400 dark:bg-brand-500"/>}
              <div class="flex w-full items-center gap-4">
                {props.IconComponent && (
                  <span
                    class={clsx(
                      props.isActive && "text-brand-600 dark:text-brand-500",
                    )}
                  >
                <props.IconComponent/>
              </span>
                )}
                <span class="w-full overflow-hidden text-ellipsis text-nowrap">{props.text}</span>
              </div>
            </button>
          </SavedLink>
        </li>
      )}
    >
      <li>
        <Collapsible.Trigger
          class={buttonClasses()}
        >
          {props.isActive && <div class="absolute left-1 min-h-4/5 min-w-1 rounded-full bg-brand-400 dark:bg-brand-500"/>}
          <span class="truncate">{props.text}</span>
          <FiChevronDown class={"ml-auto transition-transform"}/>
        </Collapsible.Trigger>
      </li>
    </Show>
  );
};

export default SidebarMenuButton;
