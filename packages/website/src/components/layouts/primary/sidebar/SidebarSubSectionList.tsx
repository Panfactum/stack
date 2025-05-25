import { For } from "solid-js";
import type { Component } from "solid-js";

import SidebarSection from "@/components/layouts/primary/sidebar/SidebarSection";
import type { DocsSubsectionMetadata } from "@/components/layouts/primary/types";

interface SidebarSubSectionListProps {
  section?: DocsSubsectionMetadata;
  fullPath: string;
  basePath: string;
}

const SidebarSubSectionList: Component<SidebarSubSectionListProps> = (
  props,
) => {
  return (
    <>
      {props.section && (
        <ul class="flex w-full min-w-0 flex-col">
          {
            <For each={props.section.sub}>
              {(section) => {
                return (
                  <li>
                    <SidebarSection
                      {...section}
                      fullPath={props.fullPath}
                      parentSectionPath={props.basePath}
                    />
                  </li>
                );
              }}
            </For>
          }
        </ul>
      )}
    </>
  );
};

export default SidebarSubSectionList;
