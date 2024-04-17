'use client'

import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useContext, useEffect, useMemo } from 'react'

import TabContainer from '@/components/layout/web/secondary/tabs/TabContainer'
import { SecondaryTabsVisibleContext } from '@/lib/contexts/web/SecondaryTabsVisible'
import useIsXSmall from '@/lib/hooks/ui/useIsXSmall'

export interface IWebTabNavigationProps {
  tabs: Array<{
    text: string
    href: string
  }>
}

export default function WebTabNavigation (props: IWebTabNavigationProps) {
  const { tabs } = props
  const pathname = usePathname()
  const value = tabs.find(tab => pathname.startsWith(tab.href))?.text ?? ''
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
  const { setVisible } = useContext(SecondaryTabsVisibleContext)
  useEffect(() => {
    setVisible(true)
    return () => setVisible(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        {tabs.map(({ text, href }) => (
          <Tab
            key={text}
            id={`nav-tab-${text}`}
            disableRipple
            label={text}
            value={text}
            href={href}
            component={Link}
            className={`normal-case whitespace-nowrap flex-shrink-0 basis-auto text-black min-h-[2.2rem] h-[2.2rem] min-w-[40px] lg:min-w-[60px] px-4 lg:px-6 py-2 lg:py-4 text-sm sm:text-base ${text === value ? 'font-semibold' : 'font-normal'}`}
          />
        ))}
      </Tabs>
    </TabContainer>
  )
}
