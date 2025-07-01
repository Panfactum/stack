import type { Component } from "solid-js";

import type { TopLevelDocsSectionMetadata } from "@/components/layouts/docs/types";
import SearchInputButton from "@/components/ui/search/SearchInputButton.tsx";

import SidebarSectionList from "./SidebarSectionList";
import SidebarSubSectionList from "./SidebarSubSectionList";
import VersionSelector from "./VersionSelector";

interface SidebarContentProps {
  setMobileNavOpen: (open: boolean) => void;
  fullPath: string;
  nonVersionedPath: string;
  activeSidebarSections: TopLevelDocsSectionMetadata[];
  activeSection: TopLevelDocsSectionMetadata;
  sectionBasePath: string;
  isVersioned: boolean;
}

const SidebarContent: Component<SidebarContentProps> = (props) => {
  return (
    <nav
      class={`
        relative flex h-fit w-full min-w-0 flex-col gap-2 px-4 pb-0
        md:pb-10
      `}
    >
      <div class={`sticky top-0 z-50 flex flex-col gap-2 bg-primary`}>
        {props.isVersioned && <VersionSelector />}
        <SearchInputButton
          onSearchOpen={() => {
            props.setMobileNavOpen(false);
          }}
        />
      </div>

      {props.activeSidebarSections.length > 1 && (
        <SidebarSectionList
          nonVersionedPath={props.nonVersionedPath}
          sections={props.activeSidebarSections}
        />
      )}

      <div class="h-px w-full bg-secondary" />
      <SidebarSubSectionList
        section={props.activeSection}
        fullPath={props.fullPath}
        basePath={props.sectionBasePath}
      />
    </nav>
  );
};
export default SidebarContent;
