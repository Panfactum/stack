import type { SideNavSection } from "@/components/documentation/DocsSidebar.tsx";
import { Versions } from "@/lib/constants.ts";

export function makeModuleDir(
  modules: Array<{ type: string; group: string; module: string }>,
  group: string,
  type: string,
) {
  return modules
    .filter((module) => module.group === group && module.type === type)
    .map(({ module }) => ({
      text: module,
      path: `/${module}`,
    }));
}

export interface VersionedSection {
  [Versions.edge]: SideNavSection[];
  [Versions.unreleased]: SideNavSection[];
  [Versions.stable_24_05]: SideNavSection[];
}

export function isValidVersion(version: string): boolean {
  return Object.values(Versions).includes(version as Versions);
}

export function stripBasePath(currentPath: string) {
  const [_, docRoot, version, ...pathArr] = currentPath.split("/");

  const isVersionedPath = isValidVersion(version);

  const path = isVersionedPath
    ? pathArr.join("/")
    : [version, ...pathArr].join("/");

  return { path, isVersionedPath, version: isVersionedPath ? version : null };
}

export function buildBreadcrumbs(
  sections: SideNavSection[],
  path: string,
): string[] {
  for (const section of sections) {
    if (path.startsWith(section.path)) {
      if (section.sub) {
        const newPath = path.substring(section.path.length);
        return [section.text].concat(buildBreadcrumbs(section.sub, newPath));
      } else {
        return [section.text];
      }
    }
  }
  return [];
}

export function buildBreadCrumbRoot(
  versionedSections: VersionedSection,
  currentPath: string,
) {
  const [_, docRoot, version, ...pathArr] = currentPath.split("/");
  const isVersionedPath = isValidVersion(version);

  const path = isVersionedPath
    ? pathArr.join("/")
    : [version, ...pathArr].join("/");

  const sections = isVersionedPath
    ? versionedSections[version as Versions]
    : versionedSections[Versions.edge];

  return buildBreadcrumbs(sections, "/" + path);
}
