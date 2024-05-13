import type { ReactNode } from 'react'

import type { IWebTabNavigationProps } from '@/components/layout/web/secondary/tabs/CustomTabs'
import CustomTabs from '@/components/layout/web/secondary/tabs/CustomTabs'

interface IWebContentLayoutProps {
  children: ReactNode
  id: string;
  tabs: IWebTabNavigationProps['tabs']
}

export default function SecondaryWebLayout (props: IWebContentLayoutProps) {
  const { children, tabs, id } = props
  return (
    <div
      className="bg-gray-light h-full"
      id={'secondary-web-layout'}
    >
      <CustomTabs
        tabs={tabs}
        id={id}
      />
      {children}
    </div>
  )
}
