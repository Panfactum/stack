'use client'

import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'

import TabContainer from '@/components/layout/web/secondary/tabs/TabContainer'
import { SecondaryTabsVisibleContext } from '@/lib/contexts/web/SecondaryTabsVisible'
import { useLocalStorage } from '@/lib/hooks/state/useLocalStorage'
import useIsXSmall from '@/lib/hooks/ui/useIsXSmall'

export interface IWebTabNavigationProps {
  id: string;
  tabs: Array<{
    text: string
    href: string
  }>
}

export default function WebTabNavigation (props: IWebTabNavigationProps) {
  const { tabs, id } = props
  const pathname = usePathname()
  const value = tabs.find(tab => pathname.startsWith(tab.href))?.text ?? false
  const isXSmall = useIsXSmall()
  const tabIndicatorProps = useMemo(() => {
    return !isXSmall
      ? {}
      : {
        sx: {
          top: 0
        }
      }
  }, [isXSmall])

  // Under each tab, we save the user's last location so that when they return to the tab their location is restored
  const [savedLocations, setSavedLocations] = useLocalStorage<{[href: string]: string}>(`saved-locations-${id}`, {})

  // This indicated whether saved locations are still valid so that we don't end up navigating users to non-existant urls
  const [validatedLocations, setValidatedLocations] = useState<{[path: string]: boolean}>({})

  // This updates the tab's saved location with the pathname changes
  useEffect(() => {
    const tab = tabs.find(tab => pathname.startsWith(tab.href))
    if (tab) {
      setValidatedLocations({ ...validatedLocations, [pathname]: true }) // This ensures we don't double load the page
      setSavedLocations({ ...savedLocations, [tab.href]: pathname })
    }
    // We explicitly do NOT want this to rerun when validatedLocations changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tabs, JSON.stringify(savedLocations)])

  // This updates validated locations every time saved locations changes
  useEffect(() => {
    let shouldUpdate = true
    const locationsToTest = Object.values(savedLocations).filter(location => !Object.prototype.hasOwnProperty.call(validatedLocations, location))
    void Promise.all(locationsToTest
      .map(location => fetch(location, { method: 'HEAD' }).then(res => [location, res.ok] as const))
    ).then(res => {
      if (shouldUpdate) {
        setValidatedLocations({ ...validatedLocations, ...Object.fromEntries(res) })
      }
    })

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
  const hrefs = tabs.reduce<{[text: typeof tabs[number]['text']]: string}>((acc, tab) => {
    const savedLocation = savedLocations[tab.href]
    return {
      ...acc,
      [tab.text]: savedLocation && validatedLocations[savedLocation] ? savedLocation : tab.href
    }
  }, {})

  return (
    <TabContainer>
      <Tabs
        aria-label="secondary tab navigation"
        variant={isXSmall ? 'scrollable' : 'fullWidth'}
        scrollButtons="auto"
        allowScrollButtonsMobile={true}
        centered={!isXSmall}
        value={value}
        className={'min-h-0'}
        TabIndicatorProps={tabIndicatorProps}
      >
        {tabs.map(({ text }) => (
          <Tab
            key={text}
            id={`nav-tab-${text}`}
            disableRipple
            label={text}
            value={text}
            href={hrefs[text] ?? '/not-found'}
            component={Link}
            className={`normal-case whitespace-nowrap flex-shrink-0 basis-auto text-black min-h-[2.2rem] h-[2.2rem] min-w-[40px] lg:min-w-[60px] px-4 lg:px-6 pt-2 pb-3 lg:py-4 text-sm sm:text-base ${text === value ? 'font-semibold' : 'font-normal'}`}
          />
        ))}
      </Tabs>
    </TabContainer>
  )
}
