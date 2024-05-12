'use client'

import { usePathname, useRouter } from 'next/navigation'
import type { ChangeEvent } from 'react'
import { useCallback, useContext, useEffect } from 'react'

import { DOCS_VERSIONS, isValidVersionSlug } from '@/lib/constants'
import { DocsVersionContext } from '@/lib/contexts/web/DocsVersion'

export default function VersionSelector () {
  const { version, setVersion } = useContext(DocsVersionContext)
  const path = usePathname()
  const router = useRouter()
  const pathSegments = path.split('/')

  // Only show if on a docs page
  const docsShowing = pathSegments.length >= 2 && pathSegments[1] === 'docs'

  const onChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    const newSlug = isValidVersionSlug(newValue) ? newValue : 'edge'

    setVersion(newSlug)

    if (docsShowing && pathSegments.length >= 3 && isValidVersionSlug(pathSegments[2])) {
      router.push(`/docs/${newSlug}/${pathSegments.slice(3).join('/')}`)
    }
  }, [setVersion, docsShowing, pathSegments, router])

  // Adjust the dropdown if we navigated directly to the docs
  useEffect(() => {
    if (pathSegments.length >= 3 && docsShowing) {
      const maybeVersionFromPath = pathSegments[2]
      if (isValidVersionSlug(maybeVersionFromPath) && version !== maybeVersionFromPath) {
        setVersion(maybeVersionFromPath)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <select
      className={`bg-white text-sm rounded px-2 py-1 font-semibold min-w-[100px] w-full sm:w-fit ${docsShowing ? 'block' : 'hidden'}`}
      value={version}
      onChange={onChange}
    >
      {DOCS_VERSIONS.map(({ text, slug }) => (
        <option
          className="hover:bg-primary hover:text-white"
          value={slug}
          key={slug}
        >
          {text}
        </option>
      ))}

    </select>
  )
}
