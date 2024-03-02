import type { ReactNode } from 'react'

import SecondaryWebLayout from '@/components/layout/web/secondary/SecondaryWebLayout'
import ArticleLayout from "@/components/layout/web/article/base/ArticleLayout";

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
    <SecondaryWebLayout tabs={TABS}>
      <ArticleLayout>
        {children}
      </ArticleLayout>
    </SecondaryWebLayout>
  )
}
