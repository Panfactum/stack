export const COPYWRITE = `Copyright © ${new Date().getFullYear()} Panfactum LLC.`

export const PANFACTUM_VERSION_MAIN = 'main'
export const PANFACTUM_VERSION_EDGE = 'edge.24-09-30'
export const PANFACTUM_VERSION_24_05 = '24-05.0'

export function replaceVersionPlaceholders (str: string) {
  return str
    .replaceAll('__PANFACTUM_VERSION_EDGE__', PANFACTUM_VERSION_EDGE)
    .replaceAll('__PANFACTUM_VERSION_24_05__', PANFACTUM_VERSION_24_05)
    .replaceAll('__PANFACTUM_VERSION_MAIN__', PANFACTUM_VERSION_MAIN)
}

export const discordServerLink = 'https://discord.gg/MJQ3WHktAS'

export const DOCS_VERSIONS = process.env.NODE_ENV === 'development'
  ? [
    { text: 'Unreleased', slug: 'main' },
    { text: 'Edge', slug: 'edge' },
    { text: '24-05', slug: '24-05' }
  ] as const
  : [
    { text: 'Edge', slug: 'edge' },
    { text: '24-05', slug: '24-05' }
  ] as const

export const slugs = DOCS_VERSIONS.map(({ slug }) => slug)
export type VersionSlug = (typeof slugs)[number]

export function isValidVersionSlug (maybeSlug: string | undefined): maybeSlug is (typeof slugs)[number] {
  return slugs.includes(maybeSlug as (typeof slugs)[number])
}

export function algoliaEnv () {
  const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
  const ALGOLIA_SEARCH_API_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY
  const ALGOLIA_INDEX_NAME = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME

  if (ALGOLIA_APP_ID === undefined || ALGOLIA_SEARCH_API_KEY === undefined || ALGOLIA_INDEX_NAME === undefined) {
    console.log('algoliaEnv', ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, ALGOLIA_INDEX_NAME)
    throw new Error('Missing Algolia environment variables')
  }

  return {
    ALGOLIA_APP_ID,
    ALGOLIA_SEARCH_API_KEY,
    ALGOLIA_INDEX_NAME
  }
}
