import 'katex/dist/katex.min.css'
import './globals.css'
import { ThemeProvider } from '@mui/material/styles'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter'
import type { Metadata } from 'next'
import Script from 'next/script'
import React, { type ReactNode } from 'react'

import WebLayout from '@/components/layout/web/primary/WebLayout'
import { theme } from '@/components/theme'
import WebContextProvider from '@/lib/contexts/web/WebContextProvider'

import { kanit } from './font'

export const metadata: Metadata = {
  title: {
    default: 'Panfactum',
    template: '%s | Panfactum'
  },
  description: 'Cloud Native System for Platform Engineering'
}

export default function RootLayout (
  { children } : {children: ReactNode}
) {
  return (
    <html lang="en">
      <body
        id="root"
        className={`${kanit.className} overflow-visible w-screen`}
      >
        {process.env.NODE_ENV === 'production' && (
          <Script
            src="https://cdn.pagesense.io/js/panfactumllc/45522f8c2b43455886f060a28de4fa9e.js"
            strategy="afterInteractive"
          />
        )}
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <WebContextProvider>
              <WebLayout>
                {children}
              </WebLayout>
            </WebContextProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>

  )
}
