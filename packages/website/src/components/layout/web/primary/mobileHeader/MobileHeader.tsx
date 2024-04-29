import { memo } from 'react'

import CTA from '@/components/layout/web/primary/CTA'
import Logo from '@/components/layout/web/primary/Logo'
import MobileHeaderContainer from '@/components/layout/web/primary/mobileHeader/MobileHeaderContainer'

export default memo(function MobileHeader () {
  return (
    <MobileHeaderContainer>
      <div className="flex flex-row justify-between pl-1 pr-2 h-full items-center">
        <Logo/>
        <CTA/>
      </div>
      <div />
    </MobileHeaderContainer>
  )
})
