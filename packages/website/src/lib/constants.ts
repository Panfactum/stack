export const COPYWRITE = `Copyright © ${new Date().getFullYear()} Panfactum LLC.`

export const PANFACTUM_VERSION_MAIN = 'main'
export const PANFACTUM_VERSION_EDGE = 'edge.24-06-04'
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
