import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import { Provider as BalancerProvider } from 'react-wrap-balancer'

import WebLayout from '@/components/layout/web/primary/WebLayout'
import WebContextProvider from '@/lib/contexts/web/WebContextProvider'

export default function RootLayout (
  { children } : {children: ReactNode}
) {
  const nonce = headers().get('x-nonce')
  return (
    <BalancerProvider nonce={nonce || ''}>
      <WebContextProvider>
        <WebLayout>
          {children}
        </WebLayout>
      </WebContextProvider>
    </BalancerProvider>
  )
}
