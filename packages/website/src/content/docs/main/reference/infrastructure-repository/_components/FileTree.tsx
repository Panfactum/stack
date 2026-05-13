import { clsx } from "clsx";
import {
  type Accessor,
  type Component,
  createSignal,
  For,
  Show,
} from "solid-js";

import type { IFileTreeNode } from "./fileTreeData";

// ─── Selection state ──────────────────────────────────────────────────────────

interface ISelectedNode {
  node: IFileTreeNode;
  path: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon(props: { open: boolean }) {
  return (
    <svg
      class={clsx(
        "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
        props.open && "rotate-90",
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      class="h-4 w-4 shrink-0 text-brand-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      class="h-4 w-4 shrink-0 text-tertiary"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

// ─── Tree node ────────────────────────────────────────────────────────────────

interface IFileTreeNodeRowProps {
  node: IFileTreeNode;
  depth: number;
  pathPrefix: string;
  selected: Accessor<ISelectedNode | null>;
  onSelect: (sel: ISelectedNode) => void;
}

const FileTreeNodeRow: Component<IFileTreeNodeRowProps> = (props) => {
  const isDir = () => props.node.type === "directory";
  const hasChildren = () =>
    isDir() && props.node.children && props.node.children.length > 0;
  const [open, setOpen] = createSignal(props.node.defaultOpen ?? false);

  const fullPath = () => {
    const prefix = props.pathPrefix;
    return prefix ? `${prefix}/${props.node.name}` : props.node.name;
  };

  const isSelected = () => {
    const sel = props.selected();
    return sel !== null && sel.path === fullPath();
  };

  function select() {
    props.onSelect({ node: props.node, path: fullPath() });
  }

  function handleRowClick() {
    if (isDir()) {
      if (hasChildren()) {
        setOpen((prev) => !prev);
      }
    } else {
      select();
    }
  }

  function handleRowKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowClick();
    }
  }

  function handleInfoClick(e: MouseEvent) {
    e.stopPropagation();
    select();
  }

  function handleInfoKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      select();
    }
  }

  return (
    <div>
      <div
        class={clsx(
          "flex items-center gap-2 rounded px-1 py-0.5",
          isDir()
            ? hasChildren() && "cursor-pointer hover:bg-white/5"
            : "cursor-pointer hover:bg-white/5",
          isSelected() && "bg-brand-500/20",
        )}
        style={{ "padding-left": `${props.depth * 1.25}rem` }}
        role="button"
        tabIndex={0}
        aria-expanded={hasChildren() ? open() : undefined}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
      >
        <Show when={hasChildren()} fallback={<span class="w-3.5" />}>
          <ChevronIcon open={open()} />
        </Show>

        <Show when={isDir()} fallback={<FileIcon />}>
          <FolderIcon />
        </Show>

        <span
          class={clsx(
            "select-none whitespace-nowrap",
            props.node.placeholder && "italic text-brand-300",
          )}
        >
          {props.node.name}
        </span>

        <Show when={isDir()}>
          <span
            class={clsx(
              "ml-1 inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-xs leading-none",
              isSelected()
                ? "bg-brand-500/30 text-brand-300"
                : "bg-white/10 text-tertiary hover:bg-white/20 hover:text-secondary",
            )}
            role="button"
            tabIndex={0}
            aria-label={`Info about ${props.node.name}`}
            onClick={handleInfoClick}
            onKeyDown={handleInfoKeyDown}
          >
            ?
          </span>
        </Show>
      </div>

      <Show when={hasChildren() && open()}>
        <div class="ml-3 border-l border-gray-dark-mode-800">
          <For each={props.node.children}>
            {(child) => (
              <FileTreeNodeRow
                node={child}
                depth={props.depth + 1}
                pathPrefix={fullPath()}
                selected={props.selected}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// ─── Detail panel ─────────────────────────────────────────────────────────────

interface IDetailPanelProps {
  selected: Accessor<ISelectedNode | null>;
}

const DetailPanel: Component<IDetailPanelProps> = (props) => {
  return (
    <div class="rounded-lg border border-primary bg-secondary p-5">
      <Show
        when={props.selected()}
        fallback={
          <p class="text-sm text-tertiary">
            Select a file or directory to view its description.
          </p>
        }
      >
        {(sel) => (
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Show
                when={sel().node.type === "directory"}
                fallback={<FileIcon />}
              >
                <FolderIcon />
              </Show>
              <span
                class={clsx(
                  "font-mono text-sm font-semibold",
                  sel().node.placeholder && "italic text-brand-300",
                )}
              >
                {sel().node.name}
              </span>
            </div>

            <p class="font-mono text-xs text-tertiary">{sel().path}</p>

            <Show when={sel().node.description}>
              <p class="text-sm text-secondary">{sel().node.description}</p>
            </Show>

            <Show when={sel().node.detail}>
              <p class="text-sm text-primary">{sel().node.detail}</p>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
};

// ─── Root component ───────────────────────────────────────────────────────────

interface IFileTreeProps {
  tree: IFileTreeNode[];
}

export const FileTree: Component<IFileTreeProps> = (props) => {
  const [selected, setSelected] = createSignal<ISelectedNode | null>(null);

  return (
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="overflow-x-auto rounded-lg border border-primary bg-secondary p-4 font-mono text-sm">
        <For each={props.tree}>
          {(node) => (
            <FileTreeNodeRow
              node={node}
              depth={0}
              pathPrefix=""
              selected={selected}
              onSelect={setSelected}
            />
          )}
        </For>
      </div>

      <div class="lg:sticky lg:top-4 lg:self-start">
        <DetailPanel selected={selected} />
      </div>
    </div>
  );
};
