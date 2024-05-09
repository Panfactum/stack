'use client'

import { createContext } from 'react'

export const SecondaryTabsVisibleContext = createContext<{
  visible: boolean;
  setVisible:(visible: boolean) => void
    }>({
      visible: false,
      setVisible: (_: boolean) => {}
    })
