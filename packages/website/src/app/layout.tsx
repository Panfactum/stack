import 'katex/dist/katex.min.css'
import './globals.css'
import Script from 'next/script'
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
  return (

    <ThemeRegistry options={{ key: 'mui', prepend: true }}>
      {process.env.NODE_ENV === 'production' && (
        <Script
          src="https://cdn.pagesense.io/js/panfactumllc/45522f8c2b43455886f060a28de4fa9e.js"
          strategy="afterInteractive"
        />
      )}
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
