import type { ReactNode } from 'react'
import { memo } from 'react'

import ArticleContainer from '@/components/layout/web/article/base/ArticleContainer'

export default memo(function ArticleLayout ({ children }: {children: ReactNode}) {
  return (
    <ArticleContainer withSidebar={false}>
      {children}
    </ArticleContainer>
  )
})
