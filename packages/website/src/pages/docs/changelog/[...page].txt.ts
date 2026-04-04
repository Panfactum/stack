// Static plain-text endpoints for changelog data, following the llmstxt.org standard.
// Detail routes serve one release at {release_id}/llm.txt.
// Stable channel routes serve a channel overview at {channel}/llm.txt.

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import {
  contentIdToUrlParam,
  getDirKey,
  getStableChannelFromId,
  resolveReferenceLink,
} from "./_components/changelogUtils";
import { getNameFromId } from "./_components/getNameFromId";

type ChangesEntry = Awaited<
  ReturnType<typeof getCollection<"changes">>
>[number];

type UpgradeInstructionsEntry = Awaited<
  ReturnType<typeof getCollection<"upgradeInstructions">>
>[number];

interface DetailProps {
  type: "detail";
  entry: ChangesEntry;
  upgradeBody?: string;
}

interface StableChannelProps {
  type: "stable-channel";
  channel: string;
  entries: ChangesEntry[];
  summaryBody?: string;
  upgradeBody?: string;
}

type RouteProps = DetailProps | StableChannelProps;

interface StaticPath {
  params: { page: string };
  props: RouteProps;
}

/**
 * Strips MDX/JSX comment lines (e.g. `{/* ... * /}`) from raw MDX source,
 * returning clean markdown suitable for plain-text output.
 */
function stripMdxComments(mdx: string): string {
  return mdx.replace(/^\{\/\*.*?\*\/\}\s*$/gm, "").trim();
}

const CHANGE_TYPE_ORDER = [
  "breaking_change",
  "addition",
  "update",
  "improvement",
  "fix",
  "deprecation",
] as const;

const CHANGE_TYPE_HEADINGS: Record<string, string> = {
  breaking_change: "Breaking Changes",
  addition: "Additions",
  update: "Version Updates",
  improvement: "Improvements",
  fix: "Fixes",
  deprecation: "Deprecations",
};

function getMdxBody(entry: UpgradeInstructionsEntry | undefined): string | undefined {
  if (!entry?.body) return undefined;
  return stripMdxComments(entry.body);
}

export async function getStaticPaths(): Promise<StaticPath[]> {
  const allChanges = await getCollection("changes");
  const allUpgradeInstructions = await getCollection("upgradeInstructions");

  const upgradeByDir = new Map(
    allUpgradeInstructions.map((e) => [getDirKey(e.id), e]),
  );

  // Detail routes — one per release entry
  const detailRoutes: StaticPath[] = allChanges.map((entry) => {
    const dirKey = getDirKey(entry.id);
    const upgradeEntry = upgradeByDir.get(dirKey);

    return {
      params: { page: `${contentIdToUrlParam(entry.id)}/llm` },
      props: {
        type: "detail",
        entry,
        upgradeBody: getMdxBody(upgradeEntry),
      },
    };
  });

  // Stable channel routes — one per stable channel
  const stableEntries = allChanges.filter((e) => e.id.startsWith("stable"));
  const stableGroups = new Map<string, ChangesEntry[]>();
  for (const entry of stableEntries) {
    const channel = getStableChannelFromId(entry.id);
    const group = stableGroups.get(channel) ?? [];
    group.push(entry);
    stableGroups.set(channel, group);
  }

  const stableChannelRoutes: StaticPath[] = [...stableGroups.entries()].map(
    ([channel, entries]) => {
      const channelKey = channel.replace("stable.", "");
      const summaryEntry = allUpgradeInstructions.find(
        (e) => e.id === `stable/${channelKey}/summary`,
      );
      const upgradeEntry = allUpgradeInstructions.find(
        (e) => e.id === `stable/${channelKey}/upgrade`,
      );

      return {
        params: { page: `${channel}/llm` },
        props: {
          type: "stable-channel",
          channel,
          entries,
          summaryBody: getMdxBody(summaryEntry),
          upgradeBody: getMdxBody(upgradeEntry),
        },
      };
    },
  );

  return [...detailRoutes, ...stableChannelRoutes];
}

function renderImpacts(
  impacts: Array<{ type: string; component: string; summary?: string }>,
): string {
  return impacts
    .map((impact) => {
      const label = `${impact.type} \`${impact.component}\``;
      return impact.summary
        ? `  - Impacts: ${label} — ${impact.summary}`
        : `  - Impacts: ${label}`;
    })
    .join("\n");
}

function renderReferences(
  references: Array<{ type: string; summary: string; link: string }>,
): string {
  return references
    .map(
      (ref) =>
        `  - Reference (${ref.type}): [${ref.summary}](${resolveReferenceLink(ref.type, ref.link)})`,
    )
    .join("\n");
}

function renderDetailEntry(entry: ChangesEntry, upgradeBody?: string): string {
  const urlParam = contentIdToUrlParam(entry.id);
  const name = getNameFromId(urlParam);
  const isMain = urlParam === "main";

  const lines: string[] = [];

  // Title
  lines.push(`# Panfactum Changelog — ${name}`);
  lines.push("");

  // Contextual notices
  if (entry.data.skip) {
    lines.push(
      "> **Warning:** This release has been flagged as one that users should skip.",
    );
    lines.push("");
  }

  if (isMain) {
    lines.push(
      "> This entry contains unreleased changes targeting the next edge release.",
    );
    lines.push("");
  }

  if (entry.data.branched_from) {
    lines.push(
      `> This stable channel was forked from [${entry.data.branched_from}](/docs/changelog/${entry.data.branched_from}).`,
    );
    lines.push("");
  }

  // Summary
  lines.push(`> ${entry.data.summary}`);
  lines.push("");

  // Highlights
  if (entry.data.highlights && entry.data.highlights.length > 0) {
    lines.push("## Highlights");
    lines.push("");
    for (const highlight of entry.data.highlights) {
      lines.push(`- ${highlight}`);
    }
    lines.push("");
  }

  // Changes grouped by type in fixed order
  if (entry.data.changes && entry.data.changes.length > 0) {
    const grouped = new Map<string, typeof entry.data.changes>();
    for (const change of entry.data.changes) {
      const group = grouped.get(change.type) ?? [];
      group.push(change);
      grouped.set(change.type, group);
    }

    for (const changeType of CHANGE_TYPE_ORDER) {
      const changes = grouped.get(changeType);
      if (!changes || changes.length === 0) continue;

      const heading = CHANGE_TYPE_HEADINGS[changeType];
      lines.push(`## ${heading}`);
      lines.push("");

      for (const change of changes) {
        lines.push(`- ${change.summary}`);
        if (change.action_items && change.action_items.length > 0) {
          for (const item of change.action_items) {
            lines.push(`  - ${item}`);
          }
        }
        if (change.impacts && change.impacts.length > 0) {
          lines.push(renderImpacts(change.impacts));
        }
        if (change.references && change.references.length > 0) {
          lines.push(renderReferences(change.references));
        }
      }
      lines.push("");
    }
  }

  // Upgrade Instructions
  if (upgradeBody) {
    lines.push("## Upgrade Instructions");
    lines.push("");
    lines.push(upgradeBody);
    lines.push("");
  }

  // Related Resources
  lines.push("## Related Resources");
  lines.push("");

  lines.push(
    `- [JSON Data](/docs/changelog/${urlParam}.json): Machine-readable data`,
  );

  const channel = urlParam.startsWith("stable.")
    ? urlParam.split(".").slice(0, 2).join(".")
    : urlParam.startsWith("edge")
      ? "edge"
      : undefined;

  if (channel) {
    lines.push(
      `- [Channel Release List](/docs/changelog/${channel}.json): All releases in this channel`,
    );
  }

  lines.push("");

  return lines.join("\n");
}

function renderStableChannel(
  channel: string,
  _entries: ChangesEntry[],
  summaryBody?: string,
  upgradeBody?: string,
): string {
  const lines: string[] = [];

  lines.push(`# Panfactum Stable Channel — ${channel}`);
  lines.push("");

  // Channel summary
  if (summaryBody) {
    lines.push(summaryBody);
    lines.push("");
  }

  // Upgrade instructions
  if (upgradeBody) {
    lines.push("## Channel Upgrade Instructions");
    lines.push("");
    lines.push(upgradeBody);
    lines.push("");
  }

  // Related Resources
  lines.push("## Related Resources");
  lines.push("");
  lines.push(
    `- [All Releases (JSON)](/docs/changelog/${channel}.json): Full release list with details for this channel`,
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Converts markdown links with absolute paths (e.g. `](/docs/foo)`) to full URLs
 * using the configured site origin so LLM consumers get globally resolvable links.
 */
function qualifyAbsoluteLinks(text: string, siteOrigin: string): string {
  return text.replace(/\]\(\//g, `](${siteOrigin}/`);
}

export const GET: APIRoute<RouteProps> = ({ props, site }) => {
  const siteOrigin = site ? site.origin : "";

  let text: string;
  if (props.type === "detail") {
    text = renderDetailEntry(props.entry, props.upgradeBody);
  } else {
    text = renderStableChannel(
      props.channel,
      props.entries,
      props.summaryBody,
      props.upgradeBody,
    );
  }

  const body = qualifyAbsoluteLinks(text, siteOrigin);
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
