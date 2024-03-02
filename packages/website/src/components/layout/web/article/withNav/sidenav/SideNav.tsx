'use client'

import { memo } from 'react'

import Nav from '@/components/layout/web/article/withNav/nav/Nav'
import SideNavContainer from '@/components/layout/web/article/withNav/sidenav/SideNavContainer'
import type { IArticleNavProps } from '@/components/layout/web/article/withNav/types'

export default memo(function SideNav (props: IArticleNavProps) {
  return (
    <SideNavContainer>
      <Nav {...props}/>
    </SideNavContainer>
  )
})
