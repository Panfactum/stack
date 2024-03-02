import type { ReactNode } from 'react'
import { memo } from 'react'

import NotFoundContentContainer from '@/components/layout/web/primary/NotFoundContentContainer'
import Footer from '@/components/layout/web/primary/footer/Footer'
import MobileHeader from '@/components/layout/web/primary/mobileHeader/MobileHeader'
import Navbar from '@/components/layout/web/primary/navbar/Navbar'

export default memo(function NotFoundLayout ({ children }: {children: ReactNode}) {
  return (
    <div className="h-full">
      <MobileHeader/>
      <Navbar/>
      <NotFoundContentContainer>
        {children}
      </NotFoundContentContainer>
      <Footer/>
    </div>
  )
})
