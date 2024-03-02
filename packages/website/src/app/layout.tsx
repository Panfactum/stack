import './globals.css'
import type { ReactNode } from 'react'

import ThemeRegistry from '@/components/ThemeRegistry'

import { kanit } from './font'

export const metadata = {
  title: 'Panfactum',
  description: 'Software monetization platform'
}

export default function RootLayout (
  { children } : {children: ReactNode}
) {
  return (
    <ThemeRegistry options={{ key: 'mui' }}>
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
