import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { replaceVersionPlaceholders } from '@/lib/constants'
import type { Status } from './StatusChip'
import StatusChip from './StatusChip'
import type { Type } from './TypeChip'
import TypeChip from './TypeChip'

export default function ModuleHeader(props: {
  status: Status
  sourceHref: string
  type: Type
  name: string
}) {
  const { status, sourceHref, type, name } = props
  const href = replaceVersionPlaceholders(sourceHref)
  return (
    <div className="flex flex-wrap mt-1 mb-3 py-1 gap-x-5 gap-y-2 border-b-2 border-solid border-secondary">
      <div className="flex gap-3 items-center">
        <code
          data-reference={name}
          className="code font-medium !text-sm sm:!text-base inline-block w-fit"
        >
          {name}
        </code>
      </div>

      <div className="flex gap-3 items-center">
        <StatusChip status={status} />
        <TypeChip type={type} />
        <a href={href}>
          <FontAwesomeIcon
            icon={faGithub}
            className="icon-fg-github"
            size={'2xl'}
          />
        </a>
      </div>
    </div>
  )
}
