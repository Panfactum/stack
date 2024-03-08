import type { ReactNode } from 'react'
import { memo } from 'react'

import type { IWebTabNavigationProps } from '@/components/layout/web/secondary/tabs/WebTabNavigation'
import WebTabNavigation from '@/components/layout/web/secondary/tabs/WebTabNavigation'

interface IWebContentLayoutProps {
  children: ReactNode
  tabs: IWebTabNavigationProps['tabs']
}

export default memo(function SecondaryWebLayout (props: IWebContentLayoutProps) {
  const { children, tabs } = props
  return (
    <div className="bg-gray-light h-full" id={"secondary-web-layout"}>
      <WebTabNavigation tabs={tabs}/>
      {children}
    </div>
  )
})
