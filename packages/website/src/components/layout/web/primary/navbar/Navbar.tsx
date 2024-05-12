import React, { memo } from 'react'

import Logo from '@/components/layout/web/primary/Logo'
import CTA from '@/components/layout/web/primary/cta/CTA'
import ChangeLogLink from '@/components/layout/web/primary/navbar/ChangeLogLink'
import NavbarContainer from '@/components/layout/web/primary/navbar/NavbarContainer'
import NavbarLink from '@/components/layout/web/primary/navbar/NavbarLink'

const Links = memo(() => {
  return (
    <>
      <NavbarLink
        href="/stack/features"
        prefix="/stack"
        text="Stack"
      />
      <NavbarLink
        href="/docs/index"
        prefix="/docs"
        text="Docs"
      />
      <ChangeLogLink/>
      <NavbarLink
        href="/about"
        prefix="/about"
        text="About"
      />
    </>
  )
})

export default memo(function Navbar () {
  return (
    <NavbarContainer>
      <div className="flex flex-row justify-between px-4 h-full items-center max-w-[1280px] mx-auto">
        <div className="hidden sm:block basis-1/3">
          <Logo/>
        </div>
        <nav
          className="flex flex-row gap-2 h-full w-full sm:w-fit"
          aria-label="primary-navigation-bar"
        >
          <Links/>
        </nav>

        <div className="hidden sm:block basis-1/3">
          <CTA/>
        </div>
      </div>
      <div/>
    </NavbarContainer>
  )
})
