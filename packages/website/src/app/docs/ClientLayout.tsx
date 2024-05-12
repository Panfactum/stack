'use client'

import type { ReactNode } from 'react'
import { useContext, useMemo } from 'react'

import SecondaryWebLayout from '@/components/layout/web/secondary/SecondaryWebLayout'
import { DocsVersionContext } from '@/lib/contexts/web/DocsVersion'

export default function ClientLayout (
  { children } : {children: ReactNode}
) {
  const { version } = useContext(DocsVersionContext)
  const TABS = useMemo(() => [
    {
      text: 'Framework',
      href: '/docs/framework'
    },
    {
      text: 'Concepts',
      href: `/docs/${version}/concepts`
    },
    {
      text: 'Guides',
      href: `/docs/${version}/guides`
    },
    {
      text: 'Reference',
      href: `/docs/${version}/reference`
    }
  ], [version])

  return (
    <SecondaryWebLayout
      tabs={TABS}
      id={'docs'}
    >
      {children}
    </SecondaryWebLayout>
  )
}
