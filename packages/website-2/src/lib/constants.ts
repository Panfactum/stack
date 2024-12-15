export const COPYWRITE = `Copyright © ${new Date().getFullYear()} Panfactum Group, Inc.`

export const PANFACTUM_VERSION_MAIN = 'main'
export const PANFACTUM_VERSION_EDGE = 'edge.24-10-25'
export const PANFACTUM_VERSION_24_05 = '24-05.0'

export function replaceVersionPlaceholders(str: string) {
  return str
    .replaceAll('__PANFACTUM_VERSION_EDGE__', PANFACTUM_VERSION_EDGE)
    .replaceAll('__PANFACTUM_VERSION_24_05__', PANFACTUM_VERSION_24_05)
    .replaceAll('__PANFACTUM_VERSION_MAIN__', PANFACTUM_VERSION_MAIN)
}

export const discordServerLink = 'https://discord.gg/MJQ3WHktAS'

export enum Versions {
  unreleased = 'main',
  edge = 'edge',
  stable_24_05 = '24-05',
}

export const DOCS_VERSIONS =
  import.meta.env.PUBLIC_NODE_ENV === 'development'
    ? ([
        { text: 'Unreleased', slug: Versions.unreleased },
        { text: 'Edge', slug: Versions.edge },
        { text: '24-05', slug: Versions.stable_24_05 },
      ] as const)
    : ([
        { text: 'Edge', slug: Versions.edge },
        { text: '24-05', slug: Versions.stable_24_05 },
      ] as const)

export function isValidVersion(version: string): boolean {
  return Object.values(Versions).includes(version as Versions)
}

export function algoliaEnv() {
  const ALGOLIA_APP_ID = import.meta.env.PUBLIC_ALGOLIA_APP_ID
  const ALGOLIA_SEARCH_API_KEY = import.meta.env.PUBLIC_ALGOLIA_SEARCH_API_KEY
  const ALGOLIA_INDEX_NAME = import.meta.env.PUBLIC_ALGOLIA_INDEX_NAME

  if (ALGOLIA_APP_ID === undefined) {
    throw new Error(
      'Missing Algolia environment variable: NEXT_PUBLIC_ALGOLIA_APP_ID',
    )
  } else if (ALGOLIA_SEARCH_API_KEY === undefined) {
    throw new Error(
      'Missing Algolia environment variable: NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY',
    )
  } else if (ALGOLIA_INDEX_NAME === undefined) {
    throw new Error(
      'Missing Algolia environment variable: NEXT_PUBLIC_ALGOLIA_INDEX_NAME',
    )
  }

  return {
    ALGOLIA_APP_ID,
    ALGOLIA_SEARCH_API_KEY,
    ALGOLIA_INDEX_NAME,
  }
}
