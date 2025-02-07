import { Dialog } from "@kobalte/core/dialog";
import { TextField } from "@kobalte/core/text-field";
import { useStore } from "@nanostores/solid";
import { createAutofocus } from "@solid-primitives/autofocus";
import { debounce } from "@solid-primitives/scheduled";
import { HiSolidMagnifyingGlass } from "solid-icons/hi";
import { IoCloseOutline } from "solid-icons/io";
import {
  type Component, createEffect,
  createSignal,
  For,
  Show,
} from "solid-js";

import { algoliaClient } from "@/lib/algolia-client.ts";
import { algoliaEnv, Versions } from "@/lib/constants.ts";
import { DocsVersionProvider, useDocsVersion } from "@/state/docsVersion.tsx";

import { isSearchModalOpen } from "./SearchDialogState.ts";

/********************************************
 Fetcher for Algolia
 ********************************************/

interface Snippet {
  value?: string;
  matchLevel: string;
}

interface HitInterface {
  objectID: string;
  breadCrumbs: string[];
  headingText: string;
  content: string[];
  hierarchy: {
    lvl0: string;
    lvl1: string;
    lvl2: string;
    lvl3: string;
    lvl4: string;
  };
  url: string;
  _snippetResult?: {
    content?: Snippet[];
  };
  _highlightResult?: {
    headingText?: Snippet;
  };
}

interface SearchResponse {
  hits: HitInterface[];
}

const { ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, ALGOLIA_INDEX_NAME } =
  algoliaEnv();

const client = algoliaClient(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY);

const fetchSearchResults = async (input: {
  query: string;
  version: Versions;
}) => {
  if (input.query == "") {
    return [];
  }

  try {
    const response = await client.post<SearchResponse>(
      `/1/indexes/${ALGOLIA_INDEX_NAME}/query`,
      {
        query: input.query,
        hitsPerPage: 5,
        attributesToSnippet: ["hierarchy.lvl1:5", "content:20"],
        filters: `version:${input.version} OR hasVersion:false`,
        highlightPostTag: "</mark>",
        highlightPreTag: "<mark>",
      },
    );

    return response.hits;
  } catch (err) {
    return [];
  }
};

/********************************************
 Search Modal / Input Component
 ********************************************/

export const SEARCH_MODAL_ID = "docs-search";

const _SearchDialog: Component = () => {
  const [version] = useDocsVersion();

  // The HTMLInput field value
  const [query, setQuery] = createSignal("");

  // The search results
  const [hits, setHits] = createSignal<HitInterface[]>([]);

  // Provide a debouncing effect on input -> search results
  const updateSearchResults = debounce((query: string) => {
    void fetchSearchResults({ query, version: version() }).then(setHits)
  }, 250);

  // Update search results when the user input changes
  createEffect(() => {
    updateSearchResults(query());
  });

  // The open state is controlled globally so it can be shared across astro islands
  const $isOpen = useStore(isSearchModalOpen);

  // The search box
  const [inputEl, setInputEl] = createSignal<HTMLInputElement>();
  createAutofocus(inputEl);

  return (
    <Dialog
      open={$isOpen()}
      onOpenChange={(open) => {isSearchModalOpen.set(open)}}
      id={SEARCH_MODAL_ID}
      modal={true}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          class={
            "fixed inset-0 z-50 w-screen max-w-[100vw] bg-[#1F242F]/80 backdrop-blur-sm"
          }
        />
        <div class="fixed left-0 top-0 z-[100] w-full  max-w-[100vw]">
          <Dialog.Content class="relative left-[calc(100%_/_12)] top-16 min-w-[calc(100%_/_6_*_5)] max-w-[calc(100%_/_6_*_5)] sm:left-[calc(100%_/_8)] sm:min-w-[75%] md:left-1/5 md:min-w-[60%] md:max-w-[60%] lg:left-1/4 lg:min-w-3/5 lg:max-w-3/5">
            <Dialog.Title class={`sr-only`}>Search Panfactum Docs</Dialog.Title>
            <TextField
              name="search"
              value={query()}
              onChange={setQuery}
              class="bg-primary flex h-12 w-full items-center overflow-hidden rounded-md pr-4 focus-within:shadow-lg dark:bg-gray-dark-mode-700"
            >
              <TextField.Label class="sr-only">
                Search Panfactum documentation
              </TextField.Label>
              <div class=" grid h-full w-12 place-items-center">
                <HiSolidMagnifyingGlass />
              </div>
              <TextField.Input
                ref={setInputEl}
                id="search"
                class="bg-primary size-full border-0 pr-8 text-sm outline-none focus:border-0 focus:ring-0 dark:bg-gray-dark-mode-700 "
                autocomplete="off"
                role="searchbox"
              />
              <Show when={query()}>
                <button
                  class="bg-primary rounded-full   dark:bg-gray-dark-mode-700"
                  on:click={() => setQuery("")}
                >
                  <IoCloseOutline />
                </button>
              </Show>
            </TextField>
            <div
              class={
                "bg-primary mt-4 flex flex-col rounded-sm px-8 py-4 dark:bg-gray-dark-mode-700"
              }
            >
              <For each={hits()} fallback={<h2>No Results</h2>}>
                {(hit) => (
                  <a
                    href={hit.url}
                    on:click={() => {isSearchModalOpen.set(false)}}
                    class="cursor-pointer py-4"
                  >
                    <h4 class=" font-bold">
                      {Object.values(hit.hierarchy)
                        .filter(Boolean)
                        .slice(0, -1)
                        .join(" > ")}
                    </h4>
                    {/* eslint-disable solid/no-innerhtml,jsx-a11y/heading-has-content */}
                    <h2
                      class=" mb-3 font-bold"
                      innerHTML={hit._highlightResult?.headingText?.value}
                    />
                    {/* eslint-enable solid/no-innerhtml,jsx-a11y/heading-has-content */}
                    <SearchContent
                      snippets={hit._snippetResult?.content ?? []}
                    />
                    <SearchCrumbs crumbs={hit.breadCrumbs} />
                  </a>
                )}
              </For>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
};

const SearchDialog: Component<{ fullPath: string }> = (props) => {
  return (
    <DocsVersionProvider fullPath={props.fullPath}>
      <_SearchDialog />
    </DocsVersionProvider>
  );
};

export default SearchDialog;

/********************************************
 Helper Components
 ********************************************/

const SearchContent = (props: { snippets: Snippet[] }) => {
  const content = () =>
    props.snippets.find((c) => c.matchLevel === "full")?.value ||
    props.snippets.find((c) => c.matchLevel === "partial")?.value ||
    props.snippets[0]?.value ||
    "";
  // eslint-disable-next-line solid/no-innerhtml
  return <p class="mb-3 text-sm" innerHTML={content()} />;
};

const SearchCrumbs: Component<{ crumbs: string[] }> = (props) => {
  return (
    <h5 class="text-xs">
      <For each={props.crumbs}>
        {(crumb, index) => (
          <Show
            when={index() === props.crumbs.length - 1}
            fallback={<span>{crumb} &gt;</span>}
          >
            <span class="font-bold">{crumb}</span>
          </Show>
        )}
      </For>
    </h5>
  );
};
