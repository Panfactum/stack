import type { ReactNode } from 'react'

import ArticleLayout from '@/components/layout/web/article/base/ArticleLayout'
import SecondaryWebLayout from '@/components/layout/web/secondary/SecondaryWebLayout'

const TABS = [
  {
    text: 'Edge',
    href: '/changelog/edge'
  },
  {
    text: '24-05',
    href: '/changelog/24-05'
  },
  {
    text: 'Roadmap',
    href: '/changelog/roadmap'
  }
]

export default function Layout (
  { children } : {children: ReactNode}
) {
  return (
    <SecondaryWebLayout
      tabs={TABS}
      id={'changelog'}
    >
      <ArticleLayout>
        {children}
      </ArticleLayout>
    </SecondaryWebLayout>
  )
}
