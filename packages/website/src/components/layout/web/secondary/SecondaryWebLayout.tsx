import type { ReactNode } from 'react'

import type { CustomTabsProps } from '@/components/layout/web/secondary/tabs/CustomTabs'
import CustomTabs from '@/components/layout/web/secondary/tabs/CustomTabs'

interface IWebContentLayoutProps {
  children: ReactNode
  tabs: CustomTabsProps['tabs']
}

export default function SecondaryWebLayout (props: IWebContentLayoutProps) {
  const { children, tabs } = props
  return (
    <div
      className="bg-gray-light h-full"
      id={'secondary-web-layout'}
    >
      <CustomTabs
        tabs={tabs}
      />
      {children}
    </div>
  )
}
