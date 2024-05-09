import type { ReactNode } from 'react'

import ArticleLayout from '@/components/layout/web/article/base/ArticleLayout'

export default function Layout ({ children }: {children: ReactNode}) {
  return (
    <ArticleLayout>
      {children}
    </ArticleLayout>
  )
}
