'use client'

import Tab from '@mui/material/Tab'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

interface CustomTabProps {
  href: string;
  text: string;
  index: number;
}
export default function CustomTab ({ href, text, index, ...props }: CustomTabProps) {
  const path = usePathname()
  const active = path.startsWith(href)

  // Save the last location the user was on the subsection represented by the NavLink
  const [savedLocation, setSavedLocation] = useLocalStorage<string>(`saved-locations-${href}`, href, { initializeWithValue: false })

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
    <Tab
      id={`nav-tab-${text}`}
      tabIndex={index}
      disableRipple
      label={text}
      value={active ? 'true' : 'false'}
      href={savedLocation && isValid ? savedLocation : href}
      component={Link}
      className={`normal-case whitespace-nowrap text-black min-h-[2.2rem] h-[2.2rem] px-4 lg:px-6 pt-2 pb-3 lg:py-4 basis-auto text-sm sm:text-base ${active ? 'font-semibold' : 'font-normal'}`}
      {...props}
    />
  )
}
