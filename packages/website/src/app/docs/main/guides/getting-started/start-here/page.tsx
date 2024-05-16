import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Start Here'
}

function Option (props: {href: string, text:string}) {
  const { href, text } = props
  return (
    <div className="flex flex-col items-center gap-5">
      <h2 className="max-w-lg text-center text-xl sm:text-2xl">
        {text}
      </h2>
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
        href={'/docs/main/guides/getting-started/overview'}
        text={"Connecting to your organization's stack?"}
      />
      <Or/>
      <Option
        href={'/docs/main/guides/bootstrapping/overview'}
        text={'Deploying the stack in your organization?'}
      />
    </div>
  )
}
