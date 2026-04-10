// Detail view component for a single changelog release entry.
// Displays highlights, summary, and an expandable card for each change with impact details.

/* eslint-disable solid/no-innerhtml */

import { Collapsible } from "@kobalte/core/collapsible";
import { Tabs } from "@kobalte/core/tabs";
import { toaster } from "@kobalte/core/toast";
import { clsx } from "clsx";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUpCircle,
  FiBookOpen,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiClipboard,
  FiCloud,
  FiDatabase,
  FiDownload,
  FiSquare,
  FiExternalLink,
  FiGitCommit,
  FiMessageCircle,
  FiPackage,
  FiPlusCircle,
  FiRefreshCw,
  FiSliders,
  FiTerminal,
  FiTrendingUp,
  FiXCircle,
} from "solid-icons/fi";
import { TbOutlineBraces, TbOutlineRobot } from "solid-icons/tb";
import { createMemo, For, Show, type Component, type JSX } from "solid-js";

import Toast from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";

import styles from "./ChangelogDetail.module.css";
import { resolveReferenceLink } from "./changelogUtils";

type ChangeType =
  | "breaking_change"
  | "fix"
  | "improvement"
  | "addition"
  | "deprecation"
  | "update";

type ImpactType =
  | "iac-module"
  | "iac-provider"
  | "cli"
  | "devshell"
  | "configuration"
  | "installer";

type ReferenceType =
  | "internal-commit"
  | "external-commit"
  | "issue-report"
  | "external-docs"
  | "internal-docs";

interface ImpactItem {
  type: ImpactType;
  component: string;
  summary: string;
}

interface ReferenceItem {
  type: ReferenceType;
  summary: string;
  link: string;
}

export interface RenderedChangeItem {
  id: string;
  type: ChangeType;
  descriptionHtml: string;
  descriptionDetailHtml?: string;
  actionItemsHtml?: string[];
  references?: ReferenceItem[];
  impacts?: ImpactItem[];
}

export interface RenderedGroup {
  type: ChangeType;
  summaryHtml: string;
  changes: string[];
}

export interface ChangelogDetailProps {
  id: string;
  name: string;
  summary: string;
  skip: boolean;
  changes?: RenderedChangeItem[];
  groups?: RenderedGroup[];
  hasUpgradeInstructions: boolean;
  initialTab?: "details" | "upgrade";
  detailUrl: string;
  upgradeUrl: string;
  listUrl?: string;
  branch?: string;
  branched_from?: string;
  nextReleaseId?: string;
  previousReleaseId?: string;
}

const CHANGE_TYPE_ORDER: ChangeType[] = [
  "breaking_change",
  "deprecation",
  "addition",
  "update",
  "improvement",
  "fix",
];

interface ChangeTypeConfig {
  label: string;
  colorClass: string;
  borderColorClass: string;
  icon: () => JSX.Element;
}

const CHANGE_TYPE_CONFIG: Record<ChangeType, ChangeTypeConfig> = {
  breaking_change: {
    label: "Breaking",
    colorClass: "text-error-400",
    borderColorClass: "border-l-error-400",
    icon: () => <FiAlertTriangle size={16} />,
  },
  deprecation: {
    label: "Deprecation",
    colorClass: "text-warning-400",
    borderColorClass: "border-l-warning-400",
    icon: () => <FiClock size={16} />,
  },
  addition: {
    label: "Addition",
    colorClass: "text-brand-300",
    borderColorClass: "border-l-brand-300",
    icon: () => <FiPlusCircle size={16} />,
  },
  improvement: {
    label: "Improvement",
    colorClass: "text-brand-300",
    borderColorClass: "border-l-brand-300",
    icon: () => <FiTrendingUp size={16} />,
  },
  update: {
    label: "Update",
    colorClass: "text-brand-300",
    borderColorClass: "border-l-brand-300",
    icon: () => <FiRefreshCw size={16} />,
  },
  fix: {
    label: "Fix",
    colorClass: "text-success-400",
    borderColorClass: "border-l-success-400",
    icon: () => <FiCheckCircle size={16} />,
  },
};

interface ImpactTypeConfig {
  label: string;
  icon: () => JSX.Element;
}

const IMPACT_TYPE_CONFIG: Record<ImpactType, ImpactTypeConfig> = {
  "iac-module": {
    label: "IaC Module",
    icon: () => <FiCloud size={14} />,
  },
  "iac-provider": {
    label: "IaC Provider",
    icon: () => <FiDatabase size={14} />,
  },
  cli: {
    label: "CLI",
    icon: () => <FiTerminal size={14} />,
  },
  devshell: {
    label: "Dev Shell",
    icon: () => <FiPackage size={14} />,
  },
  configuration: {
    label: "Configuration",
    icon: () => <FiSliders size={14} />,
  },
  installer: {
    label: "Installer",
    icon: () => <FiDownload size={14} />,
  },
};

interface ReferenceTypeConfig {
  label: string;
  icon: () => JSX.Element;
}

const REFERENCE_TYPE_CONFIG: Record<ReferenceType, ReferenceTypeConfig> = {
  "issue-report": {
    label: "Issue",
    icon: () => <FiMessageCircle size={14} />,
  },
  "internal-docs": {
    label: "Int Docs",
    icon: () => <FiBookOpen size={14} />,
  },
  "external-docs": {
    label: "Ext Docs",
    icon: () => <FiExternalLink size={14} />,
  },
  "internal-commit": {
    label: "Commit",
    icon: () => <FiGitCommit size={14} />,
  },
  "external-commit": {
    label: "Commit",
    icon: () => <FiGitCommit size={14} />,
  },
};

const REFERENCE_TYPE_ORDER: ReferenceType[] = [
  "issue-report",
  "internal-docs",
  "external-docs",
  "internal-commit",
  "external-commit",
];

const ChangeCard: Component<{
  change: RenderedChangeItem;
  index: number;
  inGroup?: boolean;
}> = (props) => {
  const config = () => CHANGE_TYPE_CONFIG[props.change.type];
  const hasDetails = () =>
    props.change.descriptionDetailHtml !== undefined ||
    (props.change.actionItemsHtml ?? []).length > 0 ||
    (props.change.impacts ?? []).length > 0 ||
    (props.change.references ?? []).length > 0;

  return (
    <Collapsible>
      <div
        id={`change-${props.change.id}`}
        class={clsx(
          "rounded-lg border border-primary bg-secondary",
          !props.inGroup &&
            `
              border-l-4
              sm:border-l
            `,
          !props.inGroup && config().borderColorClass,
        )}
      >
        <Collapsible.Trigger
          class={`
            flex w-full cursor-pointer items-center gap-3 border-0
            bg-transparent px-4 py-3 text-left
          `}
        >
          <Show when={!props.inGroup}>
            <span
              class={clsx(
                `
                  hidden shrink-0
                  sm:block
                `,
                config().colorClass,
              )}
            >
              {config().icon()}
            </span>
            <span
              class={clsx(
                `
                  hidden w-24 shrink-0 rounded-full px-2 py-0.5 text-left
                  text-xs font-semibold
                  sm:inline
                `,
                config().colorClass,
              )}
            >
              {config().label}
            </span>
          </Show>
          <div
            class={`
              flex-1
              [&_a]:underline
              [&_code]:rounded [&_code]:bg-tertiary [&_code]:px-1
              [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm
            `}
            innerHTML={props.change.descriptionHtml}
          />
          <Show when={hasDetails()}>
            <FiChevronDown
              size={16}
              class={`
                shrink-0 transition-transform duration-200
                [[data-expanded]_&]:rotate-180
              `}
            />
          </Show>
        </Collapsible.Trigger>

        <Show when={hasDetails()}>
          <Collapsible.Content class={styles.accordionContent}>
            <div class="border-t border-primary px-4 pt-3 pb-4">
              <Show when={props.change.descriptionDetailHtml !== undefined}>
                <div
                  class={clsx(
                    `
                      text-sm text-secondary
                      [&_a]:underline
                      [&_code]:rounded [&_code]:bg-tertiary [&_code]:px-1
                      [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm
                    `,
                    ((props.change.impacts ?? []).length > 0 ||
                      (props.change.references ?? []).length > 0) &&
                      "mb-4",
                  )}
                  innerHTML={props.change.descriptionDetailHtml}
                />
              </Show>
              <Show when={(props.change.actionItemsHtml ?? []).length > 0}>
                <p
                  class={clsx(
                    `
                      !my-0 !mb-4 text-xs font-semibold text-secondary underline
                      underline-offset-4
                    `,
                    props.change.descriptionDetailHtml !== undefined && "!mt-2",
                  )}
                >
                  Action Items
                </p>
                <div
                  class={clsx(
                    "ml-1 flex flex-col gap-2 text-sm text-secondary",
                    ((props.change.impacts ?? []).length > 0 ||
                      (props.change.references ?? []).length > 0) &&
                      "mb-4",
                  )}
                >
                  <For each={props.change.actionItemsHtml ?? []}>
                    {(itemHtml) => (
                      <div class="flex items-start gap-2">
                        <FiSquare
                          size={14}
                          class="mt-1 shrink-0 text-secondary"
                        />
                        <span
                          class={`
                            [&_a]:underline
                            [&_code]:rounded [&_code]:bg-tertiary [&_code]:px-1
                            [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm
                            [&_p]:!my-0
                          `}
                          innerHTML={itemHtml}
                        />
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={(props.change.impacts ?? []).length > 0}>
                <p
                  class={`
                    !my-0 !mb-4 text-xs font-semibold text-secondary underline
                    underline-offset-4
                  `}
                >
                  Impacted Components
                </p>
                <div
                  class={`
                    flex flex-col gap-4
                    sm:gap-2
                  `}
                >
                  <For each={props.change.impacts ?? []}>
                    {(impact) => (
                      <div
                        class={`
                          flex flex-col gap-1 text-sm
                          sm:flex-row sm:items-center sm:gap-3
                        `}
                      >
                        <span
                          class={`
                            flex w-fit shrink-0 items-center gap-1.5 rounded
                            bg-tertiary px-1.5 py-0.5 text-xs text-secondary
                            sm:w-28
                          `}
                        >
                          {IMPACT_TYPE_CONFIG[impact.type].icon()}
                          {IMPACT_TYPE_CONFIG[impact.type].label}
                        </span>
                        <div>
                          <code class="shrink-0 text-sm">
                            {impact.component}
                          </code>
                          <span class="mx-1 text-secondary">—</span>
                          <span class="text-secondary">{impact.summary}</span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={(props.change.references ?? []).length > 0}>
                <p
                  class={clsx(
                    `
                      !my-0 !mb-4 text-xs font-semibold text-secondary underline
                      underline-offset-4
                    `,
                    (props.change.impacts ?? []).length > 0 && "!mt-4",
                  )}
                >
                  References
                </p>
                <div
                  class={`
                    flex flex-col gap-4
                    sm:gap-2
                  `}
                >
                  <For
                    each={[...(props.change.references ?? [])].sort(
                      (a, b) =>
                        REFERENCE_TYPE_ORDER.indexOf(a.type) -
                        REFERENCE_TYPE_ORDER.indexOf(b.type),
                    )}
                  >
                    {(ref) => {
                      const refConfig = () => REFERENCE_TYPE_CONFIG[ref.type];
                      const href = () =>
                        resolveReferenceLink(ref.type, ref.link);
                      const ghRef = () => {
                        const resolvedLink = href();
                        const match =
                          /github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/(\d+)/.exec(
                            resolvedLink,
                          );
                        if (match === null || match.length < 3)
                          return undefined;
                        const repo = match[1];
                        const prefix =
                          repo === "Panfactum/stack" ? "" : `${repo} `;
                        return `${prefix}#${match[2]}`;
                      };
                      const shortSha = () => {
                        if (
                          ref.type !== "internal-commit" &&
                          ref.type !== "external-commit"
                        )
                          return undefined;
                        const match = /\/([0-9a-f]{40})(?:[/?#]|$)/.exec(
                          href(),
                        );
                        return match?.[1]?.slice(0, 7);
                      };
                      return (
                        <div
                          class={`
                            flex flex-col gap-1 text-sm
                            sm:flex-row sm:items-center sm:gap-3
                          `}
                        >
                          <span
                            class={`
                              flex w-fit shrink-0 items-center gap-1.5 rounded
                              bg-tertiary px-1.5 py-0.5 text-xs text-secondary
                              sm:w-28
                            `}
                          >
                            {refConfig().icon()}
                            {refConfig().label}
                          </span>
                          <Show
                            when={ghRef()}
                            fallback={
                              <span class="shrink-0 text-sm">
                                <a href={href()} class="underline">
                                  {ref.summary}
                                </a>
                                <Show when={shortSha()}>
                                  <span
                                    class={`
                                      ml-1 font-mono text-xs text-secondary
                                    `}
                                  >
                                    ({shortSha()})
                                  </span>
                                </Show>
                              </span>
                            }
                          >
                            <span class="shrink-0 text-sm">
                              <a href={href()} class="underline">
                                {ghRef()}
                              </a>
                              {" — "}
                              {ref.summary}
                            </span>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
              <p
                class={`
                  !mt-6 !mb-0 flex items-center justify-center gap-1.5 font-mono
                  text-xs text-secondary
                `}
              >
                Change ID: {props.change.id}
                <button
                  type="button"
                  class={`
                    cursor-pointer text-secondary
                    hover:text-primary
                  `}
                  title="Copy Change ID"
                  onClick={() => {
                    void navigator.clipboard.writeText(props.change.id);
                    const id = toaster.show((p) => (
                      <Toast
                        id={p.toastId}
                        title="Change ID copied to clipboard"
                      />
                    ));
                    setTimeout(() => toaster.dismiss(id), 2000);
                  }}
                >
                  <FiClipboard size={12} />
                </button>
              </p>
            </div>
          </Collapsible.Content>
        </Show>
      </div>
    </Collapsible>
  );
};

interface GroupCardProps {
  group: RenderedGroup;
  changes: RenderedChangeItem[];
}

const GroupCard: Component<GroupCardProps> = (props) => {
  const config = () => CHANGE_TYPE_CONFIG[props.group.type];

  return (
    <Collapsible>
      <div
        class={clsx(
          "rounded-lg border border-primary bg-secondary",
          `
            border-l-4
            sm:border-l
          `,
          config().borderColorClass,
        )}
      >
        <Collapsible.Trigger
          class={`
            flex w-full cursor-pointer items-center gap-3 border-0
            bg-transparent px-4 py-3 text-left
          `}
        >
          <span
            class={clsx(
              `
                hidden shrink-0
                sm:block
              `,
              config().colorClass,
            )}
          >
            {config().icon()}
          </span>
          <span
            class={clsx(
              `
                hidden w-24 shrink-0 rounded-full px-2 py-0.5 text-left text-xs
                font-semibold
                sm:inline
              `,
              config().colorClass,
            )}
          >
            {config().label}
          </span>
          <div
            class={`
              flex-1
              [&_a]:underline
              [&_code]:rounded [&_code]:bg-tertiary [&_code]:px-1
              [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm
            `}
            innerHTML={props.group.summaryHtml}
          />
          <span
            class={`
              shrink-0 rounded-full bg-tertiary px-2 py-0.5 text-xs
              text-secondary
            `}
          >
            {props.changes.length}
            {props.changes.length === 1 ? " change" : " changes"}
          </span>
          <FiChevronDown
            size={16}
            class={`
              shrink-0 transition-transform duration-200
              [[data-expanded]_&]:rotate-180
            `}
          />
        </Collapsible.Trigger>

        <Collapsible.Content class={styles.accordionContent}>
          <div
            class={`flex flex-col gap-3 border-t border-primary px-4 pt-3 pb-4`}
          >
            <For each={props.changes}>
              {(change, index) => (
                <ChangeCard change={change} index={index()} inGroup />
              )}
            </For>
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible>
  );
};

interface ChangesSectionProps {
  changes: RenderedChangeItem[];
  groups?: RenderedGroup[];
}

type SectionItem =
  | { kind: "group"; group: RenderedGroup; changes: RenderedChangeItem[] }
  | { kind: "change"; change: RenderedChangeItem };

const ChangesSection: Component<ChangesSectionProps> = (props) => {
  const orderedItems = createMemo((): SectionItem[] => {
    const changeMap = new Map<string, RenderedChangeItem>();
    for (const c of props.changes) {
      changeMap.set(c.id, c);
    }

    const groupedIds = new Set<string>();
    for (const g of props.groups ?? []) {
      for (const id of g.changes) {
        groupedIds.add(id);
      }
    }

    // Build items: for each type (in CHANGE_TYPE_ORDER), emit groups of that
    // type first (sorted alphabetically by summary), then ungrouped changes.
    const items: SectionItem[] = [];

    for (const type of CHANGE_TYPE_ORDER) {
      const groupsForType = (props.groups ?? [])
        .filter((g) => g.type === type)
        .sort((a, b) => a.summaryHtml.localeCompare(b.summaryHtml));

      for (const group of groupsForType) {
        const resolved = group.changes
          .map((id) => changeMap.get(id))
          .filter((c): c is RenderedChangeItem => c !== undefined);
        if (resolved.length > 0) {
          items.push({ kind: "group", group, changes: resolved });
        }
      }

      const ungrouped = props.changes.filter(
        (c) => c.type === type && !groupedIds.has(c.id),
      );
      for (const change of ungrouped) {
        items.push({ kind: "change", change });
      }
    }

    // Any changes with types not in CHANGE_TYPE_ORDER
    const knownTypes = new Set(CHANGE_TYPE_ORDER);
    const remainder = props.changes.filter(
      (c) => !knownTypes.has(c.type) && !groupedIds.has(c.id),
    );
    for (const change of remainder) {
      items.push({ kind: "change", change });
    }

    return items;
  });

  return (
    <Show
      when={props.changes.length > 0}
      fallback={
        <p class="text-secondary italic">
          No detailed changes listed for this release.
        </p>
      }
    >
      <section class="flex flex-col gap-4">
        <div class="flex flex-col gap-3">
          <For each={orderedItems()}>
            {(item, index) =>
              item.kind === "group" ? (
                <GroupCard group={item.group} changes={item.changes} />
              ) : (
                <ChangeCard change={item.change} index={index()} />
              )
            }
          </For>
        </div>
      </section>
    </Show>
  );
};

export const ChangelogDetail: Component<ChangelogDetailProps> = (props) => {
  const orderedChanges = (): RenderedChangeItem[] => {
    const changes = props.changes ?? [];
    const typeOrder = new Map(CHANGE_TYPE_ORDER.map((type, i) => [type, i]));
    return [...changes].sort(
      (a, b) => (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99),
    );
  };

  const showDetailTab = (tabValue: string) => {
    const allPanels =
      document.querySelectorAll<HTMLElement>("[data-detail-tab]");
    for (const panel of allPanels) {
      if (panel.dataset["detailTab"] === tabValue) {
        panel.classList.remove("hidden");
      } else {
        panel.classList.add("hidden");
      }
    }
  };

  const handleTabChange = (value: string) => {
    showDetailTab(value);
    const url = value === "upgrade" ? props.upgradeUrl : props.detailUrl;
    window.history.replaceState(null, "", url);
  };

  return (
    <div class="flex flex-col gap-8">
      {/* Top navigation (hidden when no links are relevant, e.g. upcoming release) */}
      <Show
        when={
          props.listUrl !== undefined ||
          props.previousReleaseId !== undefined ||
          props.nextReleaseId !== undefined
        }
      >
        <div class="flex items-center justify-between">
          <Show when={props.listUrl !== undefined}>
            <a
              href={props.listUrl}
              class={`
                flex w-fit items-center gap-2 text-sm text-secondary
                !no-underline
                hover:text-primary
              `}
            >
              <FiArrowLeft size={16} />
              Back to Release List
            </a>
          </Show>
          <Show
            when={
              props.previousReleaseId !== undefined ||
              props.nextReleaseId !== undefined
            }
          >
            <div class="flex items-center gap-2">
              <Show when={props.previousReleaseId !== undefined}>
                <a
                  href={`/docs/changelog/${props.previousReleaseId}`}
                  class={`
                    flex items-center gap-1.5 rounded-md border border-primary
                    bg-tertiary px-3 py-1.5 text-sm text-secondary !no-underline
                    hover:bg-secondary hover:text-primary
                  `}
                >
                  <FiArrowLeft size={14} />
                  Previous
                </a>
              </Show>
              <Show when={props.nextReleaseId !== undefined}>
                <a
                  href={`/docs/changelog/${props.nextReleaseId}`}
                  class={`
                    flex items-center gap-1.5 rounded-md border border-primary
                    bg-tertiary px-3 py-1.5 text-sm text-secondary !no-underline
                    hover:bg-secondary hover:text-primary
                  `}
                >
                  Next
                  <FiArrowRight size={14} />
                </a>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* Skip warning */}
      <Show when={props.skip}>
        <div
          class={`
            flex items-center gap-3 rounded-xl border-2 border-error-400/50
            bg-gray-dark-mode-900 px-4 py-2.5 text-sm
          `}
        >
          <span
            class={`
              flex size-6 shrink-0 items-center justify-center rounded-full
              bg-error-400
            `}
          >
            <FiXCircle size={16} class="text-error-900" />
          </span>
          <span>
            <b>{props.name}</b> is an unsafe release that introduced serious
            regressions. You should skip this release and go directly to{" "}
            <Show
              when={props.nextReleaseId}
              fallback={<span>the next release.</span>}
            >
              <a
                href={`/docs/changelog/${props.nextReleaseId}`}
                class="font-semibold underline"
              >
                {props.nextReleaseId}
              </a>
              .
            </Show>
          </span>
        </div>
      </Show>

      {/* Page header */}
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="!m-0 !border-0 text-display-md font-bold">
              {props.name}
            </h1>
            <Show
              when={props.hasUpgradeInstructions || props.branch !== undefined}
            >
              <Tooltip
                content={
                  props.branch !== undefined
                    ? `This edge release corresponds to the start of the ${props.branch} release channel.`
                    : "Safe to skip intermediate releases. Do not skip this one."
                }
                placement="right"
              >
                <span
                  class={`
                    flex size-8 items-center justify-center rounded-full
                    bg-success-100
                    [&_*]:!stroke-success-800
                  `}
                >
                  <FiArrowUpCircle size={24} />
                </span>
              </Tooltip>
            </Show>
            <Show when={props.branch !== undefined}>
              <a
                href={`/docs/changelog/${props.branch}/0`}
                class={`
                  !rounded-lg !bg-success-100 !px-3 !py-1.5 !text-sm
                  !font-semibold !text-success-800 !no-underline
                  hover:!bg-success-200
                `}
              >
                {props.branch}
              </a>
            </Show>
            <Show when={props.branched_from !== undefined}>
              <a
                href={`/docs/changelog/${props.branched_from}`}
                class={`
                  !rounded-lg !bg-brand-200 !px-3 !py-1.5 !text-sm
                  !font-semibold !text-brand-800 !no-underline
                  hover:!bg-brand-300
                `}
              >
                {props.branched_from}
              </a>
            </Show>
          </div>
          <div class="flex items-center gap-2">
            <Tooltip content="View as JSON" placement="top">
              <a
                href={`/docs/changelog/${props.id}.json`}
                class={`
                  flex items-center justify-center rounded-md border
                  border-primary bg-tertiary px-2 py-1 text-secondary
                  !no-underline
                  hover:bg-secondary hover:text-primary
                `}
              >
                <TbOutlineBraces size={18} />
              </a>
            </Tooltip>
            <Tooltip content="View as LLM text" placement="top">
              <a
                href={`/docs/changelog/${props.id}/llm.txt`}
                class={`
                  flex items-center justify-center rounded-md border
                  border-primary bg-tertiary px-2 py-1 text-secondary
                  !no-underline
                  hover:bg-secondary hover:text-primary
                `}
              >
                <TbOutlineRobot size={18} />
              </a>
            </Tooltip>
          </div>
        </div>
        <p class="!my-0 text-secondary">{props.summary}</p>
      </div>

      {/* Content: tabbed when upgrade instructions exist, plain otherwise */}
      <Show
        when={props.hasUpgradeInstructions}
        fallback={
          <ChangesSection changes={orderedChanges()} groups={props.groups} />
        }
      >
        <Tabs
          defaultValue={props.initialTab ?? "details"}
          onChange={handleTabChange}
        >
          <Tabs.List class="flex border-b border-primary">
            <Tabs.Trigger
              value="details"
              class={clsx(
                "cursor-pointer border-b-2 border-transparent px-4 py-2",
                "text-sm font-semibold text-secondary",
                "data-[selected]:border-brand-500 data-[selected]:text-primary",
              )}
            >
              Release Details
            </Tabs.Trigger>
            <Tabs.Trigger
              value="upgrade"
              class={clsx(
                "cursor-pointer border-b-2 border-transparent px-4 py-2",
                "text-sm font-semibold text-secondary",
                "data-[selected]:border-brand-500 data-[selected]:text-primary",
              )}
            >
              Upgrade Instructions
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="details" class="pt-6">
            <ChangesSection changes={orderedChanges()} groups={props.groups} />
          </Tabs.Content>
        </Tabs>
      </Show>
    </div>
  );
};
