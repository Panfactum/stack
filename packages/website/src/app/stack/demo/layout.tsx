import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Live',
    path: '/live'
  },
  {
    text: 'Videos',
    path: '/videos'
  }
]

export default function Layout (
  { children } : {children: ReactNode}
) {
  return (
    <ArticleWithSideNavLayout
      navSections={SIDENAV_SECTIONS}
      basePath={'/stack/demo'}
    >
      {children}
    </ArticleWithSideNavLayout>
  )
}
