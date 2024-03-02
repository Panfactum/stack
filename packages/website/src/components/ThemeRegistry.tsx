'use client'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import CssBaseline from '@mui/material/CssBaseline'
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { LicenseInfo } from '@mui/x-license-pro'
import { useServerInsertedHTML } from 'next/navigation'
import { memo, useState } from 'react'
import type { ReactNode } from 'react'

import { theme } from './theme'

// eslint-disable-next-line
LicenseInfo.setLicenseKey(process.env['NEXT_PUBLIC_MUI_X_LICENSE_KEY'] || 'Invalid')

// This is taken from this guide for using MUI with server-side components:
// https://mui.com/material-ui/guides/next-js-app-router/
export default memo(function ThemeRegistry (props: {children: ReactNode, options: Parameters<typeof createCache>[0]}) {
  const { options, children } = props

  const [{ cache, flush }] = useState(() => {
    const cache = createCache(options)
    cache.compat = true
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const prevInsert = cache.insert
    let inserted: string[] = []
    cache.insert = (...args) => {
      const serialized = args[1]
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name)
      }
      return prevInsert(...args)
    }
    const flush = () => {
      const prevInserted = inserted
      inserted = []
      return prevInserted
    }
    return { cache, flush }
  })

  useServerInsertedHTML(() => {
    const names = flush()
    if (names.length === 0) {
      return null
    }
    let styles = ''
    for (const name of names) {
      styles += cache.inserted[name]
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{
          __html: styles
        }}
      />
    )
  })

  return (
    <CacheProvider value={cache}>
      <StyledEngineProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            {children}
          </LocalizationProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </CacheProvider>
  )
})
