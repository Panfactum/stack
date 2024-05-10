import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import type { Status } from './StatusChip'
import StatusChip from './StatusChip'
import type { Type } from './TypeChip'
import TypeChip from './TypeChip'
import githubSVG from './github.svg'

export default function ModuleHeader (props: {status: Status, sourceHref: string, type: Type, name:string}) {
  const { status, sourceHref, type, name } = props
  return (
    <div className="flex flex-wrap mt-1 mb-3 py-1 gap-x-5 gap-y-2 border-b-2 border-solid border-neutral">
      <div className="flex gap-3 items-center">
        <code className="code font-medium !text-sm sm:!text-base inline-block w-fit">
          {name}
        </code>
      </div>

      <div className="flex gap-3 items-center">

        <StatusChip status={status}/>
        <TypeChip type={type}/>
        <Link href={sourceHref}>
          <Image
            src={githubSVG as string}
            alt="Source Code Link"
            height={30}
            width={30}
          />
        </Link>
      </div>
    </div>

  )
}
