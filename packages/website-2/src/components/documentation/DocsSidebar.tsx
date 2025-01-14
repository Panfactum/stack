import { useStore } from "@nanostores/react";
import { navigate } from "astro:transitions/client";
import * as React from "react";
import { type ReactNode, useState } from "react";
import {
  buildBreadcrumbs,
  stripBasePath,
  type VersionedSection,
} from "@/components/documentation/DocsSidebar/SideNavVersions.ts";
import { iconMapping } from "@/components/documentation/DocsSidebar/icons.tsx";
import type { NavIcons } from "@/components/documentation/DocsSidebar/types.ts";
import { SearchButton } from "@/components/documentation/search/search-button.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuButtonTreeItem,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar.tsx";
import Spacer from "@/components/ui/spacer.tsx";
import { useNavReferenceLink } from "@/hooks/useNavReferenceLink.ts";
import { DOCS_VERSIONS, Versions } from "@/lib/constants.ts";
import {
  documentationStore,
  sectionLastPath,
  setNavigationReferences,
  setVersion,
} from "@/stores/documentation-store.ts";
import './DocsSidebar.css'

export interface SideNavSection {
  text: string;
  path: string;
  icon?: NavIcons;
  notVersioned?: boolean;
  default?: boolean;
  sub?: SideNavSection[];
  isActive?: boolean;
}

export const SavedLink: React.FC<{
  children: ReactNode;
  href: string;
  onClick: () => void;
}> = ({ href, ...props }) => {
  const { link } = useNavReferenceLink(href);

  return <a href={link} {...props} />;
};

export interface DocSidebarProps {
  currentPath: string;
  basePath: string;
  versionedSections: VersionedSection;
}

export function DocsSidebar({
  currentPath,
  basePath,
  versionedSections,
}: DocSidebarProps) {
  const $navRefStore = useStore(sectionLastPath);
  const $docStore = useStore(documentationStore);

  const version = $docStore.version as Versions;
  const isVersioned = currentPath.startsWith(`${basePath}/${version}`);

  const sections = versionedSections[version];

  const { path } = stripBasePath(currentPath);
  const currentRoot = sections.find((item) =>
    ("/" + path).startsWith(item.path),
  );

  React.useEffect(() => {
    if (currentRoot) {
      setNavigationReferences(currentRoot?.path, currentPath);
    }
  }, [currentPath, currentRoot]);

  interface SectionProp extends SideNavSection {
    basePath: string;
    isChild?: boolean;
  }

  const Section = ({ text, path, sub, basePath = "/" }: SectionProp) => {
    const sectionPath = basePath + path;
    const isActive = !!(path && currentPath.includes(basePath + path));

    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton asChild isActive={isActive}>
              <div>
                <span aria-selected={isActive} className="font-semibold">
                  {text}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="lucide lucide-chevron-right transition-transform ml-auto group-data-[state=open]/collapsible:rotate-90"
                >
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </SidebarMenuItem>

        <CollapsibleContent>
          <SidebarMenuSub className="pl-6">
            {sub &&
              sub.map((el) => {
                if (el.sub) {
                  return (
                    <Section key={el.text} {...el} basePath={sectionPath} />
                  );
                }

                const isActive = !!(
                  el.path && currentPath.includes(sectionPath + el.path)
                );

                return (
                  <SidebarMenuItem key={el.text}>
                    <SidebarMenuButtonTreeItem asChild isActive={isActive}>
                      <a
                        href={sectionPath + el.path}
                        className="text-md"
                        onClick={() => setOpenMobile(false)}
                        aria-selected={isActive}
                      >
                        {el.text}
                      </a>
                    </SidebarMenuButtonTreeItem>
                  </SidebarMenuItem>
                );
              })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const handleVersionChange = (version: string) => {
    if (isVersioned) {
      navigate(`${basePath}/${version}/${stripBasePath(currentPath).path}`);
    } else {
      setVersion(version);
    }
  };

  const strippedPath = stripBasePath(currentPath);

  const crumbs = buildBreadcrumbs(sections, "/" + strippedPath.path);
  const [openMobile, setOpenMobile] = useState(false);

  const mainNavigationLinkActive = (path: string) => {
    return !!(path && currentPath.includes(path));
  };

  return (
    <Sidebar
      id={`sidebar-scroll`}
      currentPath={currentPath}
      crumbs={crumbs}
      openMobile={openMobile}
      setOpenMobile={setOpenMobile}
    >
      <SidebarContent>
        <SidebarMenu className="relative pb-0 md:pb-10 pl-4 pr-4">
          <div
            className={`flex flex-col gap-y-lg sticky h-full top-0 bg-primary z-top-navigation`}
          >
            <Select
              value={$docStore.version}
              onValueChange={handleVersionChange}
            >
              <SelectTrigger className="border-secondary h-[46px]">
                <SelectValue placeholder="Theme" value={$docStore.version} />
              </SelectTrigger>
              <SelectContent>
                {DOCS_VERSIONS.map((version) => (
                  <SelectItem key={version.slug} value={version.slug}>
                    {version.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchButton />
          </div>

          {sections.map((item) => (
            <SidebarMenuItem key={item.text}>
              <SidebarMenuButton
                className="h-[44px] active:bg-brand-primary-darker has-darker-active-bg"
                isActive={mainNavigationLinkActive(item.path)}
                asChild
              >
                <SavedLink
                  href={`${basePath}${item.notVersioned ? "" : `/${version}`}${item.path}`}
                  onClick={() => setOpenMobile(false)}
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    {item.icon ? iconMapping[item.icon]() : null}
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span
                      aria-selected={mainNavigationLinkActive(item.path)}
                      className="font-semibold"
                    >
                      {item.text}
                    </span>
                  </div>
                </SavedLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          <Spacer />

          {currentRoot && (
            <SidebarGroup>
              <SidebarMenu>
                {currentRoot.sub?.map((section) => {
                  const sectionBasePath = `${basePath}${currentRoot.notVersioned ? "" : `/${version}`}${currentRoot.path}`;

                  if (section.sub) {
                    return (
                      <Section
                        key={section.text}
                        {...section}
                        basePath={sectionBasePath}
                      />
                    );
                  }

                  return (
                    <SidebarMenuItem key={section.text}>
                      <SidebarMenuButtonTreeItem
                        asChild
                        isActive={currentPath.includes(section.path)}
                      >
                        <a
                          href={sectionBasePath + section.path}
                          onClick={() => setOpenMobile(false)}
                          className="font-medium"
                          aria-selected={currentPath.includes(section.path)}
                        >
                          {section.text}
                        </a>
                      </SidebarMenuButtonTreeItem>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          )}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
