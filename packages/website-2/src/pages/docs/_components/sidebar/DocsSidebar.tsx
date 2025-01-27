import { Dialog } from "@kobalte/core/dialog";
import { createResizeObserver } from "@solid-primitives/resize-observer";
import { IoChevronForwardOutline } from "solid-icons/io";
import { TbMenu } from "solid-icons/tb";
import {
  type Component,
  createMemo,
  createSignal,
  For,
  onMount,
} from "solid-js";

import SearchIconButton from "@/components/solid/ui/search/SearchIconButton.tsx";
import { DOCS_BASE_PATH } from "@/pages/docs/_components/constants.ts";
import SidebarContent from "@/pages/docs/_components/sidebar/SidebarContent.tsx";
import type { DocsMetadata } from "@/pages/docs/_components/types.ts";
import { getBreadcrumbs } from "@/pages/docs/_components/util/getBreadcrumbs.ts";
import { getDocsPathComponents } from "@/pages/docs/_components/util/getDocsPathComponents.ts";
import { DocsVersionProvider, useDocsVersion } from "@/state/docsVersion.tsx";
export interface DocSidebarProps {
  fullPath: string; // The full page path
  metadata: DocsMetadata;
}

const InternalDocsSidebar: Component<DocSidebarProps> = (props) => {
  // The current path without the version prefix (if applicable)
  const pathComponents = createMemo(() =>
    getDocsPathComponents(props.fullPath),
  );

  // The resolved version (the page path takes precedence, but fallback to the state if needed)
  const [version] = useDocsVersion();

  // Each version has a different set of sidebar sections, so this shows the current version's sections
  const activeSidebarSections = createMemo(() => {
    const sections = props.metadata[version()]
    if(sections === undefined){
      throw new Error('Invalid version selected. Could not find documentation sections for the provided version.')
    }
    return sections;
  });

  // Which top-level docs section is active
  const activeSection = createMemo(() => {
    const section = activeSidebarSections().find((item) =>
      ("/" + pathComponents().nonVersionedPath).startsWith(item.path),
    )
    if (section === undefined) {
      throw new Error('Invalid section selected. Could not find the schema for the section for the path.')
    }
    return section;
  });

  // Whether the current page is versioned
  const isVersioned = createMemo(() => pathComponents().version !== null);

  // Helps Dynamically reformat the breadcrumbs based on the available space
  let crumbsRef!: HTMLDivElement;
  const [maxCrumbsCharacterLength, setMaxCrumbsCharacterLength] =
    createSignal(32);
  onMount(() => {
    createResizeObserver(crumbsRef, ({ width }, el) => {
      if (el === crumbsRef) {
        setMaxCrumbsCharacterLength(width / 15);
      }
    });
  });

  // Breadcrumbs for displaying the current position on smaller screens
  const crumbs = createMemo(() =>
    getBreadcrumbs(
      activeSidebarSections(),
      "/" + pathComponents().nonVersionedPath,
      maxCrumbsCharacterLength(),
    ),
  );

  // Controls whether the mobile nav drawer is visible
  const [mobileNavOpen, setMobileNavOpen] = createSignal(false);

  // This is required due to an idiosyncrasy about how astro
  // handles navigation on different browsers with varying support
  // for view transitions
  const onNav = () => {
    setMobileNavOpen(false);
  };
  onMount(() => {
    window.document.addEventListener("astro:page-load", onNav);
  });

  // The path that all docs pages in this section will start with
  const sectionBasePath = createMemo(
    () =>
      `${DOCS_BASE_PATH}${isVersioned() ? `/${pathComponents().version}` : ""}${activeSection().path}`,
  );

  return (
    <>
      {/* DESKTOP VIEW */}
      <div class="border-secondary fixed top-[--header-height] hidden h-[calc(100vh_-_var(--header-height))] w-[--sidebar-width] overflow-y-auto border-r-2 pt-3 text-sm lg:block">
        <SidebarContent
          setMobileNavOpen={setMobileNavOpen}
          fullPath={props.fullPath}
          nonVersionedPath={pathComponents().nonVersionedPath}
          activeSidebarSections={activeSidebarSections()}
          activeSection={activeSection()}
          sectionBasePath={sectionBasePath()}
        />
      </div>

      {/* Mobile VIEW */}
      <div
        class="bg-primary border-primary text-tertiary sticky top-0 z-20 flex h-12 w-screen max-w-[100vw] items-center justify-between gap-2 border-b-2  px-4 text-xs md:top-[--header-height] lg:hidden"
        ref={crumbsRef}
      >
        <Dialog open={mobileNavOpen()} onOpenChange={setMobileNavOpen}>
          <Dialog.Trigger class="flex cursor-pointer items-center gap-1 overflow-x-hidden text-nowrap md:gap-2 dark:hover:text-white">
            <TbMenu />
            <For each={crumbs()}>
              {(el) => (
                <>
                  <IoChevronForwardOutline />
                  <span class="overflow-x-hidden text-ellipsis">{el}</span>
                </>
              )}
            </For>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay
              class={
                "bg-black/80 fixed inset-0 z-50 backdrop-blur-sm"
              }
            />
            <Dialog.Content class="bg-primary fixed left-0 top-0 z-[200] flex h-screen w-[--sidebar-width] flex-col overflow-y-scroll pt-8">
              <SidebarContent
                setMobileNavOpen={setMobileNavOpen}
                fullPath={props.fullPath}
                nonVersionedPath={pathComponents().nonVersionedPath}
                activeSidebarSections={activeSidebarSections()}
                activeSection={activeSection()}
                sectionBasePath={sectionBasePath()}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
        <SearchIconButton size={18} class="h-3/4" />
      </div>
    </>
  );
};

const DocsSidebar: Component<DocSidebarProps> = (props) => (
  <DocsVersionProvider fullPath={props.fullPath}>
    <InternalDocsSidebar {...props} />
  </DocsVersionProvider>
);

export default DocsSidebar;
