import { getCollection } from 'astro:content';

import type { DocsSubsectionMetadata } from '@/components/layouts/docs/types';
import { DOCS_VERSIONS } from '@/lib/constants';

import { contentIdToUrlParam, docsSlugToChangelogSlug } from '../_components/changelogUtils';


/**
 * Builds the sidebar sections for all changelog pages (list, detail, roadmap, etc.).
 */
export async function buildChangelogSidebar(): Promise<DocsSubsectionMetadata[]> {
  const sidebarChanges = await getCollection('changes');
  const sidebarUpgradeInstructions = await getCollection('upgradeInstructions');

  const sections: DocsSubsectionMetadata[] = DOCS_VERSIONS.map((version) => {
    const changelogSlug = docsSlugToChangelogSlug(version.slug);

    // Upcoming — simple leaf link
    if (version.slug === 'main') {
      return {
        text: version.label,
        path: `/${changelogSlug}`
      };
    }

    // Edge — show last 20 releases as sub-items
    if (version.slug === 'edge') {
      const edgeEntries = sidebarChanges
        .filter(e => e.id.startsWith('edge'))
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 20);

      return {
        text: version.label,
        path: `/${changelogSlug}`,
        sub: [
          { text: "Release List", path: "/0" },
          ...edgeEntries.map(entry => {
            const urlParam = contentIdToUrlParam(entry.id);
            const onUpgradePath = entry.data.upgrade_instructions !== undefined || entry.data.branch !== undefined;
            return {
              text: urlParam,
              path: `/${urlParam}`.slice(`/${changelogSlug}`.length),
              ...(onUpgradePath ? { onUpgradePath: true } : {}),
              ...(entry.data.skip ? { skip: true } : {}),
            };
          })
        ]
      };
    }

    // Stable — show summary, upgrade instructions (if available), and releases
    if (version.slug.startsWith('stable')) {
      const channelKey = changelogSlug.replace('stable.', '');
      const hasUpgrade = sidebarUpgradeInstructions.some(
        e => e.id === `stable/${channelKey}/upgrade`
      );

      const sub: Array<{text: string; path: string}> = [
        { text: "Summary", path: "/summary" },
      ];
      if (hasUpgrade) {
        sub.push({ text: "Upgrade Instructions", path: "/upgrade" });
      }
      sub.push({ text: "Releases", path: "/0" });

      return {
        text: version.label,
        path: `/${changelogSlug}`,
        sub
      };
    }

    // Fallback
    return {
      text: version.label,
      path: `/${changelogSlug}/0`
    };
  });

  // Add roadmap as the last entry
  sections.push({
    text: "Roadmap",
    path: "/roadmap",
  });

  return sections;
}
