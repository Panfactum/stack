'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import GetStartedButton from '@/components/layout/web/primary/cta/GetStartedButton'
import MobileDropdown from '@/components/layout/web/primary/cta/MobileDropdown'
import SearchButton from '@/components/layout/web/primary/cta/SearchButton'

import VersionSelector from './VersionSelector'
import githubImg from './github.svg'

export default function CTA () {
  const path = usePathname()
  const pathSegments = path.split('/')

  // Only show if on a docs page
  const docsShowing = pathSegments.length >= 2 && pathSegments[1] === 'docs'

  return (
    <>
      <div className="items-center gap-4 sm:gap-6 justify-end hidden lg:flex">
        <SearchButton docsShowing={docsShowing}/>
        <VersionSelector docsShowing={docsShowing}/>
        <Link
          href="https://github.com/Panfactum/stack"
          className="items-center flex sm:hidden md:flex"
        >
          <Image
            src={githubImg as string}
            height={30}
            width={30}
            alt="GitHub"
          />
        </Link>

        <GetStartedButton/>
      </div>

      <div className="lg:hidden flex justify-end gap-4">
        <SearchButton docsShowing={docsShowing}/>
        <MobileDropdown docsShowing={docsShowing}/>
      </div>
    </>
  )
}
