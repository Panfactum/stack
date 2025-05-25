import { type Component, Index } from "solid-js";

import { ICON_MAPPING } from "@/components/layouts/primary/sidebar/Icons";
import SidebarMenuButton from "@/components/layouts/primary/sidebar/SidebarMenuButton";
import type { TopLevelDocsSectionMetadata } from "@/components/layouts/primary/types";
import { useDocsVersion } from "@/state/docsVersion.tsx";

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
            href={`${item().notVersioned ? "" : `/${version()}`}${item().path}${item().defaultSubPath ?? ""}`}
            IconComponent={item().icon ? ICON_MAPPING[item().icon!] : undefined}
            saveUserLocation={true}
          />
        )}
      </Index>
    </ul>
  );
};

export default SidebarSectionList;
