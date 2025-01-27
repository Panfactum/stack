import type { Component } from "solid-js";

import SearchInputButton from "@/components/solid/ui/search/SearchInputButton.tsx";
import SidebarSectionList from "@/pages/docs/_components/sidebar/SidebarSectionList.tsx";
import SidebarSubSectionList from "@/pages/docs/_components/sidebar/SidebarSubSectionList.tsx";
import VersionSelector from "@/pages/docs/_components/sidebar/VersionSelector.tsx";
import type { TopLevelDocsSectionMetadata } from "@/pages/docs/_components/types.ts";

interface SidebarContentProps {
  setMobileNavOpen: (open: boolean) => void;
  fullPath: string;
  nonVersionedPath: string;
  activeSidebarSections: TopLevelDocsSectionMetadata[];
  activeSection: TopLevelDocsSectionMetadata;
  sectionBasePath: string;
}

const SidebarContent: Component<SidebarContentProps> = (props) => {
  return (
    <nav class="relative flex h-fit w-full min-w-0 flex-col gap-2 px-4 pb-0 md:pb-10">
      <div
        class={`bg-primary sticky top-0 z-top-navigation flex flex-col gap-2`}
      >
        <VersionSelector />
        <SearchInputButton onSearchOpen={() => { props.setMobileNavOpen(false); }} />
      </div>

      <SidebarSectionList
        nonVersionedPath={props.nonVersionedPath}
        sections={props.activeSidebarSections}
      />

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
