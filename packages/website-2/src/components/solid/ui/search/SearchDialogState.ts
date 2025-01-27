import { atom } from "nanostores";

/********************************************
 Global State
 ********************************************/
// We use nanostores vs signals for this b/c we want to share

// state b/w astro islands
export const isSearchModalOpen = atom(false);
