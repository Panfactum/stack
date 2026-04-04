// Flat card list component for the changelog list page.
// Displays each release as a card with summary, highlights, icon badges, and action buttons.

import { clsx } from "clsx";
import {
  FiAlertTriangle,
  FiArrowUpCircle,
  FiCheckCircle,
  FiClock,
  FiGitBranch,
  FiPlusCircle,
  FiRefreshCw,
  FiTrendingUp,
  FiXCircle,
} from "solid-icons/fi";
import { For, Show, type Component, type JSX } from "solid-js";

import Tooltip from "@/components/ui/Tooltip";

import { getNameFromId } from "./getNameFromId";

type ChangeType =
  | "breaking_change"
  | "fix"
  | "improvement"
  | "addition"
  | "deprecation"
  | "update";

interface ChangeItem {
  type: ChangeType;
  summary: string;
}

export interface ChangelogListEntry {
  id: string;
  summary: string;
  skip: boolean;
  highlights?: string[];
  changes?: ChangeItem[];
  branch?: string;
  branched_from?: string;
  upgrade_instructions?: string;
}

interface ChangelogListProps {
  entries: ChangelogListEntry[];
}

interface TypeCount {
  type: ChangeType | "skip";
  count: number;
  icon: () => JSX.Element;
  label: string;
  colorClass: string;
}

const ICON_CONFIG: Record<
  ChangeType | "skip",
  { label: string; colorClass: string; icon: () => JSX.Element }
> = {
  breaking_change: {
    label: "Breaking",
    colorClass: "text-error-400",
    icon: () => <FiAlertTriangle size={16} />,
  },
  fix: {
    label: "Fixes",
    colorClass: "text-success-400",
    icon: () => <FiCheckCircle size={16} />,
  },
  improvement: {
    label: "Improvements",
    colorClass: "text-brand-300",
    icon: () => <FiTrendingUp size={16} />,
  },
  addition: {
    label: "Additions",
    colorClass: "text-brand-300",
    icon: () => <FiPlusCircle size={16} />,
  },
  deprecation: {
    label: "Deprecations",
    colorClass: "text-warning-400",
    icon: () => <FiClock size={16} />,
  },
  update: {
    label: "Updates",
    colorClass: "text-brand-300",
    icon: () => <FiRefreshCw size={16} />,
  },
  skip: {
    label: "Skipped Release",
    colorClass: "text-gray-dark-mode-400",
    icon: () => <FiXCircle size={16} />,
  },
};

const computeTypeCounts = (entry: ChangelogListEntry): TypeCount[] => {
  if (entry.skip) {
    const config = ICON_CONFIG["skip"];
    return [
      {
        type: "skip",
        count: 1,
        icon: config.icon,
        label: config.label,
        colorClass: config.colorClass,
      },
    ];
  }

  const counts: Partial<Record<ChangeType, number>> = {};
  for (const change of entry.changes ?? []) {
    counts[change.type] = (counts[change.type] ?? 0) + 1;
  }

  const order: ChangeType[] = [
    "breaking_change",
    "deprecation",
    "addition",
    "update",
    "improvement",
    "fix",
  ];

  return order
    .filter((type) => (counts[type] ?? 0) > 0)
    .map((type) => {
      const config = ICON_CONFIG[type];
      return {
        type,
        count: counts[type] ?? 0,
        icon: config.icon,
        label: config.label,
        colorClass: config.colorClass,
      };
    });
};

const idToDetailUrl = (id: string): string => {
  return `/docs/changelog/${id}`;
};

export const ChangelogList: Component<ChangelogListProps> = (props) => {
  return (
    <div class="flex w-full flex-col gap-6">
      <For each={props.entries}>
        {(entry) => {
          const typeCounts = computeTypeCounts(entry);
          const releaseName = getNameFromId(entry.id);
          const detailUrl = idToDetailUrl(entry.id);
          const onUpgradePath =
            entry.upgrade_instructions !== undefined ||
            entry.branch !== undefined;

          return (
            <div
              role="link"
              tabIndex={0}
              onClick={() => {
                window.location.href = detailUrl;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  window.location.href = detailUrl;
                }
              }}
              class={clsx(
                `
                  relative flex cursor-pointer flex-col gap-4 rounded-xl border
                  bg-secondary px-5 pt-3 pb-5 transition-colors
                  hover:bg-tertiary
                  sm:px-6 sm:pt-4 sm:pb-6
                `,
                entry.skip
                  ? "border-2 border-error-100/50"
                  : onUpgradePath
                    ? "border-2 border-success-100/50"
                    : "border-primary",
                entry.skip && "opacity-75",
              )}
            >
              {/* Upgrade path icon overlay */}
              <Show when={onUpgradePath}>
                <div class="absolute -top-4 -left-4">
                  <Tooltip
                    content={
                      entry.branch !== undefined
                        ? `This edge release corresponds to the start of the ${entry.branch} release channel.`
                        : "Safe to skip intermediate releases. Do not skip this one."
                    }
                    placement="right"
                  >
                    <span
                      class={clsx(
                        `
                          flex items-center justify-center rounded-full
                          bg-success-100
                          [&_*]:!stroke-success-800
                        `,
                        entry.branch !== undefined
                          ? "gap-1.5 px-2.5 py-1"
                          : "size-8",
                      )}
                    >
                      <FiArrowUpCircle size={24} class="shrink-0" />
                      <Show when={entry.branch !== undefined}>
                        <span
                          class={`
                            text-xs font-semibold !text-success-800
                            [&]:!stroke-0
                          `}
                        >
                          {entry.branch}
                        </span>
                      </Show>
                    </span>
                  </Tooltip>
                </div>
              </Show>

              {/* Branched-from pill overlay */}
              <Show when={entry.branched_from !== undefined}>
                <div class="absolute -top-4 -left-4">
                  <Tooltip
                    content={`This release channel was branched from ${entry.branched_from} to create the ${entry.id.slice(0, entry.id.lastIndexOf("."))} release channel.`}
                    placement="right"
                  >
                    <a
                      href={`/docs/changelog/${entry.branched_from}`}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      class={`
                        flex items-center gap-1.5 rounded-full bg-brand-200
                        px-2.5 py-1 !no-underline
                        [&_*]:!stroke-brand-800
                      `}
                    >
                      <FiGitBranch size={16} class="shrink-0" />
                      <span
                        class={`
                          text-xs font-semibold !text-brand-800
                          [&]:!stroke-0
                        `}
                      >
                        {entry.branched_from}
                      </span>
                    </a>
                  </Tooltip>
                </div>
              </Show>

              {/* Skipped release icon overlay */}
              <Show when={entry.skip}>
                <div class="absolute -top-4 -left-4">
                  <Tooltip
                    content="This release should be skipped."
                    placement="right"
                  >
                    <span
                      class={`
                        flex size-8 items-center justify-center rounded-full
                        bg-error-100
                        [&_*]:!stroke-error-800
                      `}
                    >
                      <FiXCircle size={24} />
                    </span>
                  </Tooltip>
                </div>
              </Show>

              {/* Card header: release name + upgrade button + type count badges */}
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-3">
                  <h2 class="!m-0 !border-0 text-xl font-semibold">
                    {releaseName}
                  </h2>
                  <Show when={entry.upgrade_instructions !== undefined}>
                    <a
                      href={`${detailUrl}/upgrade`}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      class={`
                        !rounded-lg !bg-brand-550 !px-4 !py-2 !text-sm
                        !font-semibold !text-white !no-underline !ring-1
                        !ring-brand-700
                        hover:!bg-brand-800
                      `}
                    >
                      Upgrade Instructions
                    </a>
                  </Show>
                </div>
                <Show when={!entry.skip}>
                  <div class="flex flex-wrap items-center gap-2">
                    <For each={typeCounts}>
                      {(tc) => (
                        <Tooltip
                          content={`${tc.count} ${tc.label}`}
                          placement="top"
                        >
                          <span
                            class={clsx(
                              `
                                flex cursor-default items-center gap-1
                                rounded-full border border-primary px-2.5 py-1
                                text-sm font-semibold
                              `,
                              tc.colorClass,
                            )}
                          >
                            <tc.icon />
                            {tc.count}
                          </span>
                        </Tooltip>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              {/* Summary */}
              <p class="!my-0 font-semibold text-secondary">{entry.summary}</p>

              {/* Highlights */}
              <Show when={(entry.highlights ?? []).length > 0}>
                <ul class="!my-0 flex flex-col gap-0.5 !pl-5">
                  <For each={entry.highlights ?? []}>
                    {(highlight) => (
                      // eslint-disable-next-line solid/no-innerhtml
                      <li class="!my-0 !py-0" innerHTML={highlight} />
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
};
