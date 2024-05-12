import type { ReactNode } from 'react'

import ClientLayout from './ClientLayout'

export default function Layout (
  { children } : {children: ReactNode}
) {
  return (
    <ClientLayout>
      {children}
    </ClientLayout>
  )
}
