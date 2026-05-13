import { clsx } from "clsx";
import {
  type Component,
  createEffect,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
} from "solid-js";
import { isServer } from "solid-js/web";

// ─── Icons ───────────────────────────────────────────────────────────────────

const iconClass = "h-4 w-4 shrink-0 opacity-70";

function PanfactumIcon() {
  return (
    <svg
      class={iconClass}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IacIcon() {
  return (
    <svg
      class={iconClass}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

function KubernetesIcon() {
  return (
    <svg
      class={iconClass}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="M2 12h4" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="M12 22v-4" />
      <path d="m19.07 19.07-2.83-2.83" />
      <path d="M22 12h-4" />
      <path d="m19.07 4.93-2.83 2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DevShellIcon() {
  return (
    <svg
      class={iconClass}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  );
}

function OtherIcon() {
  return (
    <svg
      class={iconClass}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12.01" y1="8" y2="8" />
      <line x1="12" x2="12" y1="12" y2="16" />
    </svg>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type CategoryId = "panfactum" | "iac" | "kubernetes" | "devshell" | "other";

const CATEGORIES: ReadonlyArray<{
  id: CategoryId;
  label: string;
  description: string;
  icon: () => JSX.Element;
}> = [
  {
    id: "panfactum",
    label: "Panfactum",
    description: "Terms specific to the Panfactum framework",
    icon: PanfactumIcon,
  },
  {
    id: "iac",
    label: "IaC",
    description: "Infrastructure as Code concepts (OpenTofu, Terragrunt, etc.)",
    icon: IacIcon,
  },
  {
    id: "kubernetes",
    label: "Kubernetes",
    description: "Kubernetes and container orchestration terms",
    icon: KubernetesIcon,
  },
  {
    id: "devshell",
    label: "DevShell",
    description: "Development shell and Nix-related terms",
    icon: DevShellIcon,
  },
  {
    id: "other",
    label: "Other",
    description: "General infrastructure and platform terms",
    icon: OtherIcon,
  },
];
type SortMode = "alpha" | "category";

type IGlossaryFiltersProps = Record<string, never>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the glossary terms container */
function getContainer() {
  return document.getElementById("glossary-terms-container");
}

/** Get all <details> glossary term elements */
function getTermElements(): HTMLDetailsElement[] {
  const container = getContainer();
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLDetailsElement>("details[data-category]"),
  );
}

/** Get all TOC list items */
function getTocItems(): HTMLLIElement[] {
  const toc = document.querySelector('nav[aria-label="Table of Contents"]');
  if (!toc) return [];
  return Array.from(toc.querySelectorAll<HTMLLIElement>("li"));
}

/** Extract the slug from a TOC link's href (the #fragment part) */
function tocSlug(li: HTMLLIElement): string | null {
  const a = li.querySelector("a");
  if (!a) return null;
  const href = a.getAttribute("href");
  if (!href) return null;
  return href.replace(/^#/, "");
}

// ─── Category order for grouped sort ─────────────────────────────────────────

const CATEGORY_ORDER: Record<CategoryId, number> = {
  panfactum: 0,
  iac: 1,
  kubernetes: 2,
  devshell: 3,
  other: 4,
};

// ─── Component ───────────────────────────────────────────────────────────────

export const GlossaryFilters: Component<IGlossaryFiltersProps> = () => {
  const [activeCategories, setActiveCategories] = createSignal<Set<CategoryId>>(
    new Set(CATEGORIES.map((c) => c.id)),
  );
  const [sortMode, setSortMode] = createSignal<SortMode>("category");

  // ── Toggle a single category ──────────────────────────────────────────────

  function toggleCategory(id: CategoryId) {
    setActiveCategories((prev) => {
      // If all are active, narrow to just the clicked category
      if (prev.size === CATEGORIES.length) {
        return new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) {
        // Don't allow deactivating all categories
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Enable all categories ─────────────────────────────────────────────────

  function enableAll() {
    setActiveCategories(new Set(CATEGORIES.map((c) => c.id)));
  }

  // ── Ensure hash-targeted term's category is visible ───────────────────────

  function revealTermByHash(hash: string) {
    if (!hash) return;

    const slug = hash.replace(/^#/, "");
    const el = getTermElements().find(
      (d) => d.querySelector(`h2#${CSS.escape(slug)}`) !== null,
    );
    if (!el) return;

    const category = el.dataset.category as CategoryId | undefined;
    if (category && !activeCategories().has(category)) {
      // Synchronously unhide the element so scrollIntoView works immediately
      el.style.display = "";
      setActiveCategories((prev) => {
        const next = new Set(prev);
        next.add(category);
        return next;
      });
    }
  }

  function handleHashChange() {
    revealTermByHash(window.location.hash);
  }

  function handleRevealEvent(e: Event) {
    const detail = (e as CustomEvent<{ hash: string }>).detail;
    revealTermByHash(detail.hash);
  }

  // ── Hash change listener ──────────────────────────────────────────────────

  onMount(() => {
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    document.addEventListener("glossary:reveal", handleRevealEvent);
  });

  onCleanup(() => {
    if (isServer) return;
    window.removeEventListener("hashchange", handleHashChange);
    document.removeEventListener("glossary:reveal", handleRevealEvent);
  });

  // ── Reactive effect: filter + sort DOM ────────────────────────────────────

  createEffect(() => {
    const active = activeCategories();
    const sort = sortMode();
    if (isServer) return;
    const container = getContainer();
    if (!container) return;

    const terms = getTermElements();

    // Filter: show/hide based on active categories
    for (const el of terms) {
      const cat = el.dataset.category as CategoryId;
      el.style.display = active.has(cat) ? "" : "none";
    }

    // Sort: reorder DOM nodes
    const sorted = [...terms].sort((a, b) => {
      if (sort === "category") {
        const catA = CATEGORY_ORDER[a.dataset.category as CategoryId];
        const catB = CATEGORY_ORDER[b.dataset.category as CategoryId];
        if (catA !== catB) return catA - catB;
      }
      // Alphabetical within same category (or always for alpha mode)
      const nameA = a.querySelector(".glossary-term-name")?.textContent ?? "";
      const nameB = b.querySelector(".glossary-term-name")?.textContent ?? "";
      return nameA.localeCompare(nameB);
    });

    for (const el of sorted) {
      container.appendChild(el);
    }

    // Sync TOC visibility
    const visibleSlugs = new Set(
      terms
        .filter((el) => active.has(el.dataset.category as CategoryId))
        .map((el) => el.querySelector("h2")?.id)
        .filter(Boolean),
    );

    for (const li of getTocItems()) {
      const slug = tocSlug(li);
      if (slug !== null) {
        li.style.display = visibleSlugs.has(slug) ? "" : "none";
      }
    }
  });

  // ── Check if all categories are active ────────────────────────────────────

  const allActive = () => activeCategories().size === CATEGORIES.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div class="mb-6 flex flex-wrap items-center gap-3">
      {/* Category filter buttons */}
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class={clsx(
            "cursor-pointer rounded-md border px-2 py-1 text-sm transition-colors",
            allActive()
              ? "border-brand-500/50 bg-brand-500/20 text-primary"
              : "border-primary bg-tertiary text-secondary hover:bg-secondary hover:text-primary",
          )}
          onClick={enableAll}
        >
          All
        </button>
        <For each={CATEGORIES}>
          {(cat) => (
            <button
              type="button"
              title={cat.description}
              class={clsx(
                "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm transition-colors",
                activeCategories().has(cat.id)
                  ? "border-brand-500/50 bg-brand-500/20 text-primary"
                  : "border-primary bg-tertiary text-secondary hover:bg-secondary hover:text-primary",
              )}
              onClick={() => {
                toggleCategory(cat.id);
              }}
            >
              {cat.icon()}
              {cat.label}
            </button>
          )}
        </For>
      </div>

      {/* Sort toggle */}
      <div class="ml-auto flex items-center gap-2">
        <span class="text-sm text-tertiary">Sort:</span>
        <button
          type="button"
          class={clsx(
            "cursor-pointer rounded-md border px-2 py-1 text-sm transition-colors",
            sortMode() === "category"
              ? "border-brand-500/50 bg-brand-500/20 text-primary"
              : "border-primary bg-tertiary text-secondary hover:bg-secondary hover:text-primary",
          )}
          onClick={() => setSortMode("category")}
        >
          By Category
        </button>
        <button
          type="button"
          class={clsx(
            "cursor-pointer rounded-md border px-2 py-1 text-sm transition-colors",
            sortMode() === "alpha"
              ? "border-brand-500/50 bg-brand-500/20 text-primary"
              : "border-primary bg-tertiary text-secondary hover:bg-secondary hover:text-primary",
          )}
          onClick={() => setSortMode("alpha")}
        >
          A–Z
        </button>
      </div>
    </div>
  );
};
