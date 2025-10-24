import { type Component, Index } from "solid-js";

import { ICON_MAPPING } from "@/components/layouts/docs/sidebar/Icons";
import type { TopLevelDocsSectionMetadata } from "@/components/layouts/docs/types";
import { useDocsVersion } from "@/state/docsVersion.tsx";

import SidebarMenuButton from "./SidebarMenuButton";

interface SidebarSectionListProps {
  sections: TopLevelDocsSectionMetadata[];
  nonVersionedPath: string;
}

const SidebarSectionList: Component<SidebarSectionListProps> = (props) => {
  const [version] = useDocsVersion();

  return (
    <ul>
      <Index each={props.sections}>
        {/* eslint-disable @typescript-eslint/no-non-null-assertion */}
        {(item) => (
          <SidebarMenuButton
            activeClass={"bg-tertiary"}
            text={item().text}
            isActive={("/" + props.nonVersionedPath).startsWith(item().path)}
            href={`/docs/${item().notVersioned ? "" : `${version()}`}${item().path}${item().defaultSubPath ?? ""}`}
            IconComponent={item().icon ? ICON_MAPPING[item().icon!] : undefined}
            saveUserLocation={true}
          />
        )}
      </Index>
    </ul>
  );
};

export default SidebarSectionList;
