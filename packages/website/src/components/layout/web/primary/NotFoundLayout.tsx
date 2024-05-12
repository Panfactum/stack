import type { ReactNode } from 'react'
import { memo } from 'react'

import NotFoundContentContainer from '@/components/layout/web/primary/NotFoundContentContainer'

export default memo(function NotFoundLayout ({ children }: {children: ReactNode}) {
  return (
    <NotFoundContentContainer>
      {children}
    </NotFoundContentContainer>
  )
})
