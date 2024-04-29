import { LogIn } from 'iconoir-react'
import Image from 'next/image'
import Link from 'next/link'

import githubImg from './github.svg'

export default function CTA () {
  return (
    <div className="items-center gap-4 sm:gap-6 flex">
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
      <Link
        href="/docs/guides/getting-started/start-here"
        className="bg-white text-primary py-1 px-2 rounded-lg font-bold flex items-center"
      >
        <span className="hidden lg:inline">Get Started</span>
        <LogIn
          className="inline lg:hidden"
          strokeWidth={2.5}
        />
      </Link>
    </div>
  )
}
