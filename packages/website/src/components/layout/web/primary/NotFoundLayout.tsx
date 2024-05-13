import type { ReactNode } from 'react'

import NotFoundContentContainer from '@/components/layout/web/primary/NotFoundContentContainer'

export default function NotFoundLayout ({ children }: {children: ReactNode}) {
  return (
    <NotFoundContentContainer>
      {children}
    </NotFoundContentContainer>
  )
}
