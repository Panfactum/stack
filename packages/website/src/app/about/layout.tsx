import type { ReactNode } from 'react'

import ArticleLayout from '@/components/layout/web/article/base/ArticleLayout'
import SecondaryWebLayout from '@/components/layout/web/secondary/SecondaryWebLayout'

const TABS = [
  {
    text: 'Mission',
    href: '/about/mission'
  },
  {
    text: 'Company',
    href: '/about/company'
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
