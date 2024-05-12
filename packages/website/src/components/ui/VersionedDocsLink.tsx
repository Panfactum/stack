'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useContext } from 'react'

import { DocsVersionContext } from '@/lib/contexts/web/DocsVersion'

export default function VersionedDocsLink (props: {path: string, className?: string, children?: ReactNode}) {
  const { version } = useContext(DocsVersionContext)
  const { path, ...otherProps } = props
  return (
    <Link
      {...otherProps}
      href={`/docs/${version}${path}`}
    />
  )
}
