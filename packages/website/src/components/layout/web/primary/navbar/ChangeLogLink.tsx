'use client'

import React, { useContext } from 'react'

import NavbarLink from '@/components/layout/web/primary/navbar/NavbarLink'
import { DocsVersionContext } from '@/lib/contexts/web/DocsVersion'

export default function ChangeLogLink () {
  const { version } = useContext(DocsVersionContext)
  return (
    <NavbarLink
      href={`/changelog/${version}`}
      prefix="/changelog"
      text="Changelog"
    />
  )
}
