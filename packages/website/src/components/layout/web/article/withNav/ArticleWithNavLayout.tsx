import type { ReactNode } from 'react'

import ArticleContainer from '@/components/layout/web/article/base/ArticleContainer'
import ArticleWithNavContainer from '@/components/layout/web/article/withNav/ArticleWithNavContainer'
import SideNav from '@/components/layout/web/article/withNav/sidenav/SideNav'
import TopNav from '@/components/layout/web/article/withNav/topnav/TopNav'
import type { IArticleNavProps } from '@/components/layout/web/article/withNav/types'

interface Props {
  children: ReactNode,
  navSections: IArticleNavProps['sections']
  basePath: IArticleNavProps['basePath']
}
export default function ArticleWithSideNavLayout ({ children, navSections, basePath }: Props) {
  return (
    <ArticleWithNavContainer>
      <SideNav
        sections={navSections}
        basePath={basePath}
      />
      <div className="flex flex-col w-full">
        <TopNav
          sections={navSections}
          basePath={basePath}
        />
        <ArticleContainer withSidebar={true}>
          {children}
        </ArticleContainer>
      </div>

    </ArticleWithNavContainer>
  )
}
