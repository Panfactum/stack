import React, { memo } from 'react'

import CTA from '@/components/layout/web/primary/CTA'
import Logo from '@/components/layout/web/primary/Logo'
import NavbarContainer from '@/components/layout/web/primary/navbar/NavbarContainer'
import NavbarLink from '@/components/layout/web/primary/navbar/NavbarLink'

const Links = memo(() => {
  return (
    <>
      <NavbarLink
        href="/stack"
        text="Stack"
      />
      <NavbarLink
        href="/docs"
        text="Docs"
      />
      <NavbarLink
        href="/changelog"
        text="Changelog"
      />
      <NavbarLink
        href="/about"
        text="About"
      />
    </>
  )
})

export default memo(function Navbar () {
  return (
    <NavbarContainer>
      <div className="flex flex-row justify-between px-4 h-full items-center max-w-[1280px] mx-auto">
        <div className="hidden sm:block">
          <Logo/>
        </div>
        <nav
          className="flex flex-row gap-2 justify-self-center h-full w-full sm:w-fit"
          aria-label="primary-navigation-bar"
        >
          <Links/>
        </nav>
        <div className="hidden sm:block">
          <CTA/>
        </div>
      </div>
      <div/>
    </NavbarContainer>
  )
})
