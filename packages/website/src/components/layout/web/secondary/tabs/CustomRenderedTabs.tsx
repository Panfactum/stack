import styled from '@emotion/styled'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Link from 'next/link'
import { useMemo } from 'react'

import {
  BREAKPOINT,
  WEB_NAVBAR_BORDER_WIDTH_PX,
  WEB_NAVBAR_HEIGHT_REM,
  WEB_TABBAR_BORDER_WIDTH_PX,
  WEB_TABBAR_HEIGHT_REM
} from '@/components/theme'

const TabContainer = styled.nav`
  height: ${WEB_TABBAR_HEIGHT_REM}rem;
  min-height: ${WEB_TABBAR_HEIGHT_REM}rem !important;
  z-index: 50;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: baseline;
  background-color: ${props => props.theme.extraColors.gray.light};

  // Only on small devices
  bottom: calc(${WEB_NAVBAR_HEIGHT_REM}rem + ${WEB_NAVBAR_BORDER_WIDTH_PX}px);
  position: fixed;
  border-top: ${props => `${WEB_NAVBAR_BORDER_WIDTH_PX}px solid ${props.theme.extraColors.gray.dark}`};
  
  // Only on large devices
  @media (min-width: ${BREAKPOINT.SM}px) {
    border-top: none;
    border-bottom: ${props => `${WEB_TABBAR_BORDER_WIDTH_PX}px solid ${props.theme.palette.primary.light}`};
    position: sticky;
    top: calc(${WEB_NAVBAR_HEIGHT_REM}rem + ${WEB_NAVBAR_BORDER_WIDTH_PX}px);
    bottom: initial;
  }
`

interface CustomRenderedTabsPops {
  isXSmall: boolean
  value: string | boolean,
  tabs: Array<{text: string, href: string}>
}
export default function CustomRenderedTabs ({ isXSmall, value, tabs }: CustomRenderedTabsPops) {
  const tabIndicatorProps = useMemo(() => {
    return !isXSmall
      ? {}
      : {
        sx: {
          top: 0
        }
      }
  }, [isXSmall])

  return (
    <TabContainer>
      <Tabs
        aria-label="secondary tab navigation"
        variant={isXSmall ? 'scrollable' : 'fullWidth'}
        scrollButtons="auto"
        allowScrollButtonsMobile={false}
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
            className={`normal-case whitespace-nowrap text-black min-h-[2.2rem] h-[2.2rem] px-4 lg:px-6 pt-2 pb-3 lg:py-4 basis-auto text-sm sm:text-base ${text === value ? 'font-semibold' : 'font-normal'}`}
          />
        ))}
      </Tabs>
    </TabContainer>
  )
}
