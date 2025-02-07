import { useStore } from "@nanostores/solid";
import { createShortcut } from "@solid-primitives/keyboard";
import { HiSolidMagnifyingGlass } from "solid-icons/hi";
import { type Component, createEffect } from "solid-js";

import { SEARCH_MODAL_ID } from "@/components/ui/search/SearchDialog.tsx";
import { isSearchModalOpen } from "@/components/ui/search/SearchDialogState.ts";

interface SearchButtonProps {
  onSearchOpen?: () => void;
}

const SearchInputButton: Component<SearchButtonProps> = (props) => {
  createShortcut(["Control", "K"], () => { isSearchModalOpen.set(true); }, {
    preventDefault: true,
  });

  const $isOpen = useStore(isSearchModalOpen);

  createEffect(() => {
    if ($isOpen() && props.onSearchOpen) {
      props.onSearchOpen();
    }
  });

  return (
    <button
      class="border-primary flex h-10 cursor-pointer  items-center gap-4 rounded-md border bg-gray-light-mode-100 px-3 text-sm shadow-sm focus-within:ring-1 focus-within:ring-offset-2 hover:bg-gray-light-mode-300 dark:bg-gray-dark-mode-800 hover:dark:bg-gray-dark-mode-700"
      on:click={() => { isSearchModalOpen.set(true); }}
      aria-controls={SEARCH_MODAL_ID}
      aria-haspopup={true}
      aria-expanded={$isOpen()}
    >
      <HiSolidMagnifyingGlass />
      <span>Quick Search ...</span>
      <span class="ml-auto hidden md:block">Ctrl + K</span>
    </button>
  );
};

export default SearchInputButton;
