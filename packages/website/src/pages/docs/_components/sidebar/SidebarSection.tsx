import { Collapsible } from "@kobalte/core/collapsible";
import { clsx } from "clsx";
import {type Component, createMemo, For, Show} from "solid-js";

import type { DocsSubsectionMetadata } from "@/pages/docs/_components/types.ts";

import SidebarMenuButton from "./SidebarMenuButton.tsx";


interface SidebarSectionProps extends DocsSubsectionMetadata {
  parentSectionPath: string;
  fullPath: string;
  isChild?: boolean;
}

const SidebarSection: Component<SidebarSectionProps> = (props) => {
  const sectionPath = createMemo(() => props.parentSectionPath + props.path);
  const isActive = createMemo(
    () => {
      // This case handles the landing page for each documentation section ("/")
      if(props.path === "/"){
        return props.fullPath === sectionPath()
      }
      // This is for all other paths
      return !!(props.path && props.fullPath.startsWith(sectionPath()))
    },
  );
  const hasChildren = () => !!props.sub;

  return (
    <Show
      when={hasChildren()}
      fallback={(
        <SidebarMenuButton
          isActive={isActive()}
          text={props.text}
          expandable={false}
          href={sectionPath()}
          isChild={props.isChild}
        />
      )}
    >
      <Collapsible
        as="ul"
        class={clsx(
          "flex min-w-0 translate-x-px flex-col gap-1 py-1",
          props.isChild && "pl-4",
        )}
        defaultOpen={isActive()}
      >
        <SidebarMenuButton
          isActive={isActive()}
          text={props.text}
          expandable={true}
        />
        <Collapsible.Content as="li">
          <ul class="flex flex-col gap-1">
            <For each={props.sub || []}>
              {(el) => (
                <SidebarSection
                  {...el}
                  isChild={true}
                  fullPath={props.fullPath}
                  parentSectionPath={sectionPath()}
                />
              )}
            </For>
          </ul>
        </Collapsible.Content>
      </Collapsible>
    </Show>
  )
};

export default SidebarSection;
