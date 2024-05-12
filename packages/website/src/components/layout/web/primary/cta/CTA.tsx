import Image from 'next/image'
import Link from 'next/link'

import GetStartedButton from '@/components/layout/web/primary/cta/GetStartedButton'
import MobileDropdown from '@/components/layout/web/primary/cta/MobileDropdown'

import VersionSelector from './VersionSelector'
import githubImg from './github.svg'

export default function CTA () {
  return (
    <>

      <div className="items-center gap-4 sm:gap-6 justify-end hidden lg:flex">
        <VersionSelector/>
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
      <div className="lg:hidden flex justify-end">
        <MobileDropdown/>
      </div>
    </>
  )
}
