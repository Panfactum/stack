import type { DocsSubsectionMetadata } from "@/pages/docs/_components/types.ts";

export function getBreadcrumbs(
  sections: DocsSubsectionMetadata[],
  path: string,
  maxLength: number,
): string[] {
  let crumbs = buildBreadCrumbs(sections, path);

  // Ensure the breadcrumbs won't exceed the string length
  // First, we try to remove middle elements

  let crumbsStringLength = crumbs.reduce((acc, cur) => acc + cur.length, 0);
  if (crumbsStringLength > maxLength && crumbs.length >= 3) {
    crumbs = [crumbs[0], "...", crumbs[crumbs.length - 1]];
    crumbsStringLength = crumbs.reduce((acc, cur) => acc + cur.length, 0);
  }

  // Then, if it is still too long, we return just the last element
  if (crumbsStringLength > maxLength) {
    crumbs = [crumbs[crumbs.length - 1]];
  }

  return crumbs;
}

function buildBreadCrumbs(
  sections: DocsSubsectionMetadata[],
  path: string,
): string[] {
  for (const section of sections) {
    if (path.startsWith(section.path)) {
      if (section.sub) {
        const subPath = path.substring(section.path.length);
        return [section.text].concat(buildBreadCrumbs(section.sub, subPath));
      } else {
        return [section.text];
      }
    }
  }
  return [];
}
