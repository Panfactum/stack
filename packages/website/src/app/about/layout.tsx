import type { ReactNode } from 'react'

import ArticleLayout from '@/components/layout/web/article/base/ArticleLayout'
import SecondaryWebLayout from '@/components/layout/web/secondary/SecondaryWebLayout'

const TABS = [
  {
    text: 'Mission',
    href: '/about/mission'
  },
  {
    text: 'History',
    href: '/about/history'
  },
  {
    text: 'Contact',
    href: '/about/contact'
  }
]

export default function Layout (
  { children } : {children: ReactNode}
) {
  return (
    <SecondaryWebLayout
      tabs={TABS}
      id={'about'}
    >
      <ArticleLayout>
        {children}
      </ArticleLayout>
    </SecondaryWebLayout>
  )
}
