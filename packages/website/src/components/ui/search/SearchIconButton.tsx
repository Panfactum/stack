import { useStore } from "@nanostores/solid";
import { clsx } from "clsx";
import { HiSolidMagnifyingGlass } from "solid-icons/hi";
import { type Component, createEffect } from "solid-js";

import { SEARCH_MODAL_ID } from "@/components/ui/search/SearchDialog.tsx";
import { isSearchModalOpen } from "@/components/ui/search/SearchDialogState.ts";

interface SearchButtonProps {
  onSearchOpen?: () => void;
  size?: number;
  class?: string;
}

const SearchIconButton: Component<SearchButtonProps> = (props) => {
  const $isOpen = useStore(isSearchModalOpen);

  createEffect(() => {
    if ($isOpen() && props.onSearchOpen) {
      props.onSearchOpen();
    }
  });

  return (
    <button
      class={clsx(
        `
          flex h-10 cursor-pointer items-center gap-4 rounded-md border
          border-primary bg-gray-light-mode-100 px-3 text-sm
          text-gray-dark-mode-50 shadow-sm
          focus-within:ring-1 focus-within:ring-offset-2
          hover:bg-gray-light-mode-300
          dark:bg-gray-dark-mode-800 dark:hover:bg-gray-dark-mode-900
        `,
        props.class,
      )}
      on:click={() => {
        isSearchModalOpen.set(true);
      }}
      aria-controls={SEARCH_MODAL_ID}
      aria-haspopup={true}
      aria-expanded={$isOpen()}
    >
      <HiSolidMagnifyingGlass size={props.size || 24} stroke-width={1} />
    </button>
  );
};

export default SearchIconButton;
