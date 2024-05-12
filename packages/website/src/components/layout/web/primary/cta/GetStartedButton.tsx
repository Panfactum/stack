'use client'

import { usePathname } from 'next/navigation'

import VersionedDocsLink from '@/components/ui/VersionedDocsLink'

export default function GetStartedButton () {
  const path = usePathname()
  const docsShowing = path.startsWith('/docs')

  if (docsShowing) {
    return null
  }
  return (
    <VersionedDocsLink
      path="/guides/getting-started/start-here"
      className="bg-white text-primary py-1 px-2 rounded-lg font-semibold flex items-center"
    >
      Get Started
    </VersionedDocsLink>
  )
}
