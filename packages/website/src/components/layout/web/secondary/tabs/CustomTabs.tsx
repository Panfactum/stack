'use client'

import { usePathname } from 'next/navigation'
import { useContext, useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

import CustomRenderedTabs from '@/components/layout/web/secondary/tabs/CustomRenderedTabs'
import { SecondaryTabsVisibleContext } from '@/lib/contexts/web/SecondaryTabsVisible'
import useIsXSmall from '@/lib/hooks/ui/useIsXSmall'

export interface IWebTabNavigationProps {
  id: string;
  tabs: Array<{
    text: string
    href: string
  }>
}

export default function CustomTabs (props: IWebTabNavigationProps) {
  const { tabs, id } = props
  const pathname = usePathname()
  const value = tabs.find(tab => pathname.startsWith(tab.href))?.text ?? false
  const isXSmall = useIsXSmall()

  // Under each tab, we save the user's last location so that when they return to the tab their location is restored
  const [savedLocations, setSavedLocations] = useLocalStorage<{[href: string]: string}>(`saved-locations-${id}`, {}, { initializeWithValue: false })

  // This indicated whether saved locations are still valid so that we don't end up navigating users to non-existant urls
  const [validatedLocations, setValidatedLocations] = useState<{[path: string]: boolean}>({})
  const [isValidating, setIsValidating] = useState(false)

  // This updates the tab's saved location with the pathname changes
  useEffect(() => {
    const tab = tabs.find(tab => pathname.startsWith(tab.href))
    if (tab) {
      setValidatedLocations({ ...validatedLocations, [pathname]: true }) // This ensures we don't double load the page
      setSavedLocations({ ...savedLocations, [tab.href]: pathname })
    }
    // We explicitly do NOT want this to rerun when validatedLocations changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tabs])

  // This updates validated locations every time saved locations changes
  useEffect(() => {
    let shouldUpdate = true
    const locationsToTest = Object.values(savedLocations).filter(location => !Object.prototype.hasOwnProperty.call(validatedLocations, location))
    if (!isValidating) {
      setIsValidating(true)
      void Promise.all(locationsToTest
        .map(location => fetch(location, { method: 'HEAD' })
          .then(res => [location, res.ok] as const)
          .catch(_ => [location, false] as const)
        )
      ).then(res => {
        if (shouldUpdate) {
          setValidatedLocations({ ...validatedLocations, ...Object.fromEntries(res) })
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
    // We explicitly only want this to re-run when savedLocations changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(savedLocations)])

  // This changes whether the tabs are visible or not depending on screen size
  const { setVisible } = useContext(SecondaryTabsVisibleContext)
  useEffect(() => {
    setVisible(true)
    return () => setVisible(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate the hrefs to actually use on the tab links
  // depending on whether there is a saved and validated location for each tab
  const savedTabs = tabs.map(tab => {
    const savedLocation = savedLocations[tab.href]
    return {
      text: tab.text,
      href: savedLocation && validatedLocations[savedLocation] ? savedLocation : tab.href
    }
  })

  return (
    <CustomRenderedTabs
      isXSmall={isXSmall}
      value={value}
      tabs={savedTabs}
    />
  )
}
