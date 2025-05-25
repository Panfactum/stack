import type { Component } from "solid-js";

import SidebarSectionList from "@/components/layouts/primary/sidebar/SidebarSectionList";
import SidebarSubSectionList from "@/components/layouts/primary/sidebar/SidebarSubSectionList";
import VersionSelector from "@/components/layouts/primary/sidebar/VersionSelector";
import type { TopLevelDocsSectionMetadata } from "@/components/layouts/primary/types";
import SearchInputButton from "@/components/ui/search/SearchInputButton.tsx";

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
    <nav class="relative flex h-fit w-full min-w-0 flex-col gap-2 px-4 pb-0 md:pb-10">
      <div
        class={`bg-primary sticky top-0 z-top-navigation flex flex-col gap-2`}
      >
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

      <div class="bg-secondary h-px w-full dark:bg-gray-dark-mode-700" />
      <SidebarSubSectionList
        section={props.activeSection}
        fullPath={props.fullPath}
        basePath={props.sectionBasePath}
      />
    </nav>
  );
};
export default SidebarContent;
