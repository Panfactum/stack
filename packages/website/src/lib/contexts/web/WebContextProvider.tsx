'use client'

import type { ReactNode } from 'react'
import { memo, useMemo, useState } from 'react'
import { Provider as BalancerProvider } from 'react-wrap-balancer'
import { useLocalStorage } from 'usehooks-ts'

import type { VersionSlug } from '@/lib/constants'
import { SecondaryTabsVisibleContext } from '@/lib/contexts/web/SecondaryTabsVisible'

import { DocsVersionContext } from './DocsVersion'

export default memo(function WebContextProvider ({ children }: {children: ReactNode}) {
  // Secondary Tab State
  const [secondaryTabsVisible, setSecondaryTabsVisible] = useState(false)
  const secondaryTabsVisibleContextValue = useMemo(() => ({
    visible: secondaryTabsVisible,
    setVisible: setSecondaryTabsVisible
  }), [secondaryTabsVisible, setSecondaryTabsVisible])

  // Docs version
  const [version, setVersion] = useLocalStorage<VersionSlug>('version', 'edge', { initializeWithValue: false })
  const docsVersionContextValue = useMemo(() => ({
    version,
    setVersion
  }), [version, setVersion])

  return (
    <BalancerProvider>
      <SecondaryTabsVisibleContext.Provider value={secondaryTabsVisibleContextValue}>
        <DocsVersionContext.Provider value={docsVersionContextValue}>

          {children}
        </DocsVersionContext.Provider>
      </SecondaryTabsVisibleContext.Provider>
    </BalancerProvider>
  )
})
