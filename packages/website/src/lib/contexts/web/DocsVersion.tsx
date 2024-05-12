'use client'

import { createContext } from 'react'

import type { VersionSlug } from '@/lib/constants'

export const DocsVersionContext = createContext<{
  version: VersionSlug,
  setVersion:(version: VersionSlug) => void
    }>({ version: 'edge', setVersion: (_) => {} })
