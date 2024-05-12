import { memo } from 'react'

import Logo from '@/components/layout/web/primary/Logo'
import CTA from '@/components/layout/web/primary/cta/CTA'
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
