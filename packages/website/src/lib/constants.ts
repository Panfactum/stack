import { NODE_ENV, ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, ALGOLIA_INDEX_NAME } from "astro:env/client"

import { CONSTANTS } from "./versions";

export const COPYWRITE = `Copyright © ${new Date().getFullYear()} Panfactum Group, Inc.`;

export const SIGNUP_LINK =
  "https://hs.panfactum.com/meetings/jack-langston/intro";



export const GITHUB_URL = "https://github.com/Panfactum/stack";
export const DISCORD_URL = "https://discord.gg/MJQ3WHktAS";

export interface VersionOption {
  label: string;
  slug: string;
}

export const DOCS_VERSIONS: VersionOption[] = Object.entries(CONSTANTS.versions)
  .map(([_, { label, slug }]) => ({ label, slug }))
  .filter((opt) => NODE_ENV === "development" || opt.slug !== "main")

export function algoliaEnv() {
  return {
    ALGOLIA_APP_ID,
    ALGOLIA_SEARCH_API_KEY,
    ALGOLIA_INDEX_NAME
  };
}
