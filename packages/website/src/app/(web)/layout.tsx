import type { ReactNode } from 'react'

import WebLayout from '@/components/layout/web/primary/WebLayout'
import WebContextProvider from '@/lib/contexts/web/WebContextProvider'

export default function RootLayout (
  { children } : {children: ReactNode}
) {
  return (
    <WebContextProvider>
      <WebLayout>
        {children}
      </WebLayout>
    </WebContextProvider>
  )
}
