import { NODE_ENV, ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, ALGOLIA_INDEX_NAME  } from "astro:env/client"

import constants from "./constants.json"
export const COPYWRITE = `Copyright © ${new Date().getFullYear()} Panfactum Group, Inc.`;


export const PANFACTUM_VERSION_MAIN = constants.panfactum_version_main;
export const PANFACTUM_VERSION_EDGE = constants.panfactum_version_edge;

export const SIGNUP_LINK =
  "https://hs.panfactum.com/meetings/jack-langston/intro";

export function replaceVersionPlaceholders(str: string) {
  return str
    .replaceAll("__PANFACTUM_VERSION_EDGE__", PANFACTUM_VERSION_EDGE)
    .replaceAll("__PANFACTUM_VERSION_MAIN__", PANFACTUM_VERSION_MAIN);
}

export const GITHUB_URL = "https://github.com/Panfactum/stack";
export const DISCORD_URL = "https://discord.gg/MJQ3WHktAS";

export enum Versions {
  unreleased = "main",
  edge = "edge",
}

export interface VersionOption {
  text: string;
  slug: Versions;
}

export const DOCS_VERSIONS: VersionOption[] =
  (NODE_ENV === "development"
    ? ([
        { text: "Unreleased", slug: Versions.unreleased },
        { text: "Edge", slug: Versions.edge },
      ])
    : ([{ text: "Edge", slug: Versions.edge }]))

export function algoliaEnv() {
  return {
    ALGOLIA_APP_ID,
    ALGOLIA_SEARCH_API_KEY,
    ALGOLIA_INDEX_NAME
  };
}
