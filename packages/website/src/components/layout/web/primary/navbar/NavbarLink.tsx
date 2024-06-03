'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo, useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

interface NavbarLinkProps {
  href: string;
  text: string;
  prefix: string;
}
export default memo(function NavbarLink ({ href, text, prefix }: NavbarLinkProps) {
  const path = usePathname()
  const active = path.startsWith(prefix)

  // Save the last location the user was on the subsection represented by the NavLink
  const [savedLocation, setSavedLocation] = useLocalStorage<string>(`saved-locations-${text}`, href, { initializeWithValue: false })

  // This indicated whether saved location is still valid so that we don't end up navigating users to non-existant urls
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // This updates the saved location with the pathname changes
  useEffect(() => {
    if (active) {
      setIsValid(true) // This ensures we don't double load the page
      setSavedLocation(path)
    }
    // We explicitly do NOT want this to rerun when isValid changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, active])

  // This updates validated locations every time saved locations changes
  useEffect(() => {
    let shouldUpdate = true
    if (isValid === null && savedLocation !== href && !isValidating) {
      setIsValidating(true)
      void fetch(savedLocation, { method: 'HEAD' })
        .then(res => res.ok)
        .catch(_ => false)
        .then(res => {
          if (shouldUpdate) {
            setIsValid(res)
          }
        }).finally(() => {
          if (shouldUpdate) {
            setIsValidating(false)
          }
        })
    }

    // Ensures we don't have an error if the promise resolves after the component unmounts
    return () => {
      shouldUpdate = false
    }
    // We explicitly only want this to re-run when savedLocation changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLocation])

  return (
    <Link
      href={savedLocation && isValid ? savedLocation : href}
      className={`${active ? 'bg-gray-light text-black  border-solid border-gray-light h-[calc(100%_+_4px)] font-semibold' : 'text-white h-full'} self-end sm:self-auto flex items-center no-underline text-sm sm:text-lg grow box-border`}
    >
      <div className={`grow sm:min-w-[10px] rounded-tr-lg sm:rounded-tr-none sm:rounded-br-lg bg-primary h-full border-gray-dark border-solid ${active ? 'border-r-4 border-t-4 sm:border-t-0 sm:border-b-4' : ''}`}/>
      <div className={`px-4 text-center ${active ? 'pt-1 sm:pb-2' : ''}`}>
        {text}
      </div>
      <div className={`grow sm:min-w-[10px] sm:rounded-bl-lg rounded-tl-lg sm:rounded-tl-none bg-primary h-full border-gray-dark border-solid ${active ? 'border-l-4 border-t-4 sm:border-t-0 sm:border-b-4' : ''}`}/>
    </Link>
  )
})
