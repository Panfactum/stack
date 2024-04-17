import type { ReactNode } from 'react'

import SecondaryWebLayout from '@/components/layout/web/secondary/SecondaryWebLayout'

const TABS = [
  {
    text: 'Framework',
    href: '/docs/framework'
  },
  {
    text: 'Concepts',
    href: '/docs/concepts'
  },
  {
    text: 'Guides',
    href: '/docs/guides'
  },
  {
    text: 'Architecture',
    href: '/docs/architecture'
  },
  {
    text: 'Reference',
    href: '/docs/reference'
  }
]

export default function Layout (
  { children } : {children: ReactNode}
) {
  return (
    <SecondaryWebLayout tabs={TABS}>
      {children}
    </SecondaryWebLayout>
  )
}
