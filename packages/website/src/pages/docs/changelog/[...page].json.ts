// Static JSON endpoints for changelog data.
// Detail endpoints serve full release data (e.g., /docs/changelog/edge.25-04-03.json).
// List endpoints serve high-level summaries for a channel (e.g., /docs/changelog/edge.json, /docs/changelog/stable.25-04.json).

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import { contentIdToUrlParam, getStableChannelFromId, resolveReferenceLink } from "./_components/changelogUtils";
import { getNameFromId } from "./_components/getNameFromId";

type ChangesEntry = Awaited<
  ReturnType<typeof getCollection<"changes">>
>[number];

type DetailProps = {
  type: "detail";
  entry: ChangesEntry;
  nextReleaseId?: string;
  previousReleaseId?: string;
};
type ListProps = { type: "list"; channel: string; entries: ChangesEntry[] };

export async function getStaticPaths() {
  const allChanges = await getCollection("changes");

  // Build next/previous maps per channel
  const channelEntries = new Map<string, ChangesEntry[]>();
  for (const entry of allChanges) {
    const channel = entry.id.split("/")[0] ?? "";
    const existing = channelEntries.get(channel) ?? [];
    existing.push(entry);
    channelEntries.set(channel, existing);
  }
  const nextReleaseById = new Map<string, string>();
  const previousReleaseById = new Map<string, string>();
  for (const entries of channelEntries.values()) {
    const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      nextReleaseById.set(current.id, contentIdToUrlParam(next.id));
      previousReleaseById.set(next.id, contentIdToUrlParam(current.id));
    }
  }

  // Detail routes — one per release entry
  const detailRoutes = allChanges.map((entry) => ({
    params: { page: contentIdToUrlParam(entry.id) },
    props: {
      type: "detail" as const,
      entry,
      nextReleaseId: nextReleaseById.get(entry.id),
      previousReleaseId: previousReleaseById.get(entry.id),
    },
  }));

  // List route for edge channel
  const edgeEntries = allChanges.filter((e) => e.id.startsWith("edge"));
  const edgeListRoute = {
    params: { page: "edge" },
    props: { type: "list" as const, channel: "edge", entries: edgeEntries },
  };

  // List routes for each stable channel
  const stableEntries = allChanges.filter((e) => e.id.startsWith("stable"));
  const stableGroups = new Map<string, ChangesEntry[]>();
  for (const entry of stableEntries) {
    const channel = getStableChannelFromId(entry.id);
    const group = stableGroups.get(channel) ?? [];
    group.push(entry);
    stableGroups.set(channel, group);
  }

  const stableListRoutes = [...stableGroups.entries()].map(
    ([channel, entries]) => ({
      params: { page: channel },
      props: { type: "list" as const, channel, entries },
    }),
  );

  return [...detailRoutes, edgeListRoute, ...stableListRoutes];
}

export const GET: APIRoute<DetailProps | ListProps> = ({ props }) => {
  if (props.type === "detail") {
    const { entry } = props;
    const urlParam = contentIdToUrlParam(entry.id);

    // Derive the channel list slug from the entry ID
    const rawChannel = entry.id.split("/")[0] ?? "";
    const listSlug = rawChannel === "main"
      ? "edge"
      : rawChannel === "stable"
        ? getStableChannelFromId(entry.id)
        : rawChannel;

    const json = {
      id: urlParam,
      name: getNameFromId(urlParam),
      summary: entry.data.summary,
      skip: entry.data.skip,
      branch: entry.data.branch,
      highlights: entry.data.highlights,
      changes: entry.data.changes?.map((change) => ({
        ...change,
        references: change.references?.map((ref) => ({
          ...ref,
          link: resolveReferenceLink(ref.type, ref.link),
        })),
      })),
      on_upgrade_path: entry.data.upgrade_instructions !== undefined || entry.data.branch !== undefined,
      list_url: `/docs/changelog/${listSlug}.json`,
      llm_txt_url: `/docs/changelog/${urlParam}/llm.txt`,
      next: props.nextReleaseId ? `/docs/changelog/${props.nextReleaseId}.json` : undefined,
      prev: props.previousReleaseId ? `/docs/changelog/${props.previousReleaseId}.json` : undefined,
    };

    return new Response(JSON.stringify(json, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // List response — high-level summary of each release in the channel
  const sorted = [...props.entries].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const releases = sorted.map((entry) => {
    const urlParam = contentIdToUrlParam(entry.id);
    const changeTypeCounts = new Map<string, number>();
    for (const change of entry.data.changes ?? []) {
      changeTypeCounts.set(
        change.type,
        (changeTypeCounts.get(change.type) ?? 0) + 1,
      );
    }

    return {
      id: urlParam,
      name: getNameFromId(urlParam),
      url: `/docs/changelog/${urlParam}`,
      json_url: `/docs/changelog/${urlParam}.json`,
      llm_txt_url: `/docs/changelog/${urlParam}/llm.txt`,
      summary: entry.data.summary,
      skip: entry.data.skip,
      on_upgrade_path: entry.data.upgrade_instructions !== undefined || entry.data.branch !== undefined,
      upgrade_instructions_url: entry.data.upgrade_instructions !== undefined
        ? `/docs/changelog/${urlParam}/upgrade`
        : undefined,
      branch: entry.data.branch,
      branched_from: entry.data.branched_from,
      highlights: entry.data.highlights,
      change_counts: Object.fromEntries(changeTypeCounts),
    };
  });

  const json = {
    channel: props.channel,
    total_releases: releases.length,
    releases,
  };

  return new Response(JSON.stringify(json, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
