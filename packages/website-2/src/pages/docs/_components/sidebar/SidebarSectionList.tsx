import { type Component, Index } from "solid-js";

import { DOCS_BASE_PATH } from "@/pages/docs/_components/constants.ts";
import { ICON_MAPPING } from "@/pages/docs/_components/sidebar/Icons.tsx";
import SidebarMenuButton from "@/pages/docs/_components/sidebar/SidebarMenuButton.tsx";
import type { TopLevelDocsSectionMetadata } from "@/pages/docs/_components/types.ts";
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
            href={`${DOCS_BASE_PATH}${item().notVersioned ? "" : `/${version()}`}${item().path}`}
            IconComponent={item().icon ? ICON_MAPPING[item().icon!] : undefined}
            saveUserLocation={true}
          />
        )}
      </Index>
    </ul>
  );
};

export default SidebarSectionList;
