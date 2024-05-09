import type { ReactNode } from 'react'

import Footer from '@/components/layout/web/primary/footer/Footer'
import MobileHeader from '@/components/layout/web/primary/mobileHeader/MobileHeader'
import Navbar from '@/components/layout/web/primary/navbar/Navbar'

export default function WebLayout ({ children }: {children: ReactNode}) {
  return (
    <div
      className="h-full"
      id={'primary-web-layout'}
    >
      <MobileHeader/>
      <Navbar/>
      {children}
      <Footer/>
    </div>
  )
}
