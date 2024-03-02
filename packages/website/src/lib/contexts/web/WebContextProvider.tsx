'use client'

import type { ReactNode } from 'react'
import { memo, useMemo, useState } from 'react'

import { SecondaryTabsVisibleContext } from '@/lib/contexts/web/SecondaryTabsVisible'

export default memo(function WebContextProvider ({ children }: {children: ReactNode}) {
  // Secondary Tab State
  const [secondaryTabsVisible, setSecondaryTabsVisible] = useState(false)
  const secondaryTabsVisibleContextValue = useMemo(() => ({
    visible: secondaryTabsVisible,
    setVisible: setSecondaryTabsVisible
  }), [secondaryTabsVisible, setSecondaryTabsVisible])

  return (
    <SecondaryTabsVisibleContext.Provider value={secondaryTabsVisibleContextValue}>
      {children}
    </SecondaryTabsVisibleContext.Provider>
  )
})
