import Button from '@mui/material/Button'
import Image from 'next/image'
import Link from 'next/link'
import { memo } from 'react'

import MobileHeaderContainer from '@/components/layout/web/primary/mobileHeader/MobileHeaderContainer'

export default memo(function MobileHeader () {
  return (
    <MobileHeaderContainer>
      <div className="flex flex-row justify-between pl-1 pr-2 h-full items-center">
        <Link
          href="/"
          className="text-white text-3xl flex flex-row gap-x-1 items-center"
        >
          <Image
            alt="Panfactum Logo"
            src="/logo.svg"
            width={40}
            height={40}
          />
          Panfactum
        </Link>
        <div>
          <Button
            variant="contained"
            className="bg-white text-primary font-semibold text-xs"
            size="small"
          >
            <Link href="/docs/guides/getting-started/start-here">
              Get Started
            </Link>
          </Button>
        </div>
      </div>
      <div />
    </MobileHeaderContainer>
  )
})
