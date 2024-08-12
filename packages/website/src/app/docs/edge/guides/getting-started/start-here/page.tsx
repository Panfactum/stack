import type { Metadata } from 'next'
import Link from 'next/link'

import Balancer from '@/components/ui/Balancer'

export const metadata: Metadata = {
  title: 'Start Here'
}

function Option (props: {href: string, text:string, description:string}) {
  const { href, text, description } = props
  return (
    <div className="flex flex-col items-center">
      <h2 className="max-w-lg text-center text-xl sm:text-2xl">
        <Balancer>
          {text}
        </Balancer>
      </h2>
      <h3 className="max-w-4xl text-center mb-5 mt-2 text-sm sm:text-base italic font-normal">
        <Balancer>
          {description}
        </Balancer>
      </h3>
      <Link
        href={href}
        className="bg-primary text-lg sm:text-xl font-bold text-white px-6 sm:px-8 py-2 sm:py-4 inline-block rounded-xl"
      >
        Start Here
      </Link>
    </div>
  )
}

function Or () {
  return (
    <div className="flex items-center gap-4 justify-center">
      <div className="bg-black h-1 w-4"/>
      <span className="text-black text-2xl font-bold">
        OR
      </span>
      <div className="bg-black h-1 w-4"/>
    </div>
  )
}

export default function StartHerePage () {
  return (
    <div className="flex flex-col gap-12 py-20">
      <Option
        href={'/docs/edge/guides/bootstrapping/overview'}
        text={'Deploying the Panfactum Stack in your organization?'}
        description={'You are bootstrapping new Panfactum infrastructure in your organization for the first time.'}
      />
      <Or/>
      <Option
        href={'/docs/edge/guides/getting-started/overview'}
        text={"Connecting to your organization's existing Panfactum infrastructure?"}
        description={'Someone has already deployed Panfactum in your organization, and you want to connect to that infrastructure.'}
      />
    </div>
  )
}
