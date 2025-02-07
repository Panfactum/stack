import { For } from "solid-js";
import type { Component } from "solid-js";

import SidebarSection from "@/pages/docs/_components/sidebar/SidebarSection.tsx";
import type { DocsSubsectionMetadata } from "@/pages/docs/_components/types.ts";

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
          {<For each={props.section.sub}>{(section) => {
            return (
              <li>
                <SidebarSection
                  {...section}
                  fullPath={props.fullPath}
                  parentSectionPath={props.basePath}
                />
              </li>
            );
          }}</For>}
        </ul>
      )}
    </>
  );
};

export default SidebarSubSectionList;
