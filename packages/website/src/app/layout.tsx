import { headers } from 'next/headers'
import 'katex/dist/katex.min.css'
import './globals.css'
import React, { type ReactNode } from 'react'

import ThemeRegistry from '@/components/ThemeRegistry'

import { kanit } from './font'

export const metadata = {
  title: 'Panfactum',
  description: 'Cloud Native System for Platform Engineering'
}

export default function RootLayout (
  { children } : {children: ReactNode}
) {
  const nonce = headers().get('x-nonce')
  return (

    <ThemeRegistry options={{ key: 'mui', prepend: true, nonce: nonce === null ? undefined : nonce }}>
      <html lang="en">
        <body
          id="root"
          className={`${kanit.className} overflow-visible w-screen`}
        >
          {children}
        </body>
      </html>
    </ThemeRegistry>
  )
}
