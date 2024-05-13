import type { ReactNode } from 'react'

import ArticleContainer from '@/components/layout/web/article/base/ArticleContainer'

export default function ArticleLayout ({ children }: {children: ReactNode}) {
  return (
    <ArticleContainer withSidebar={false}>
      {children}
    </ArticleContainer>
  )
}
