import type { TooltipProps } from '@mui/material'
import Tooltip from '@mui/material/Tooltip'
import type { ReactNode } from 'react'
import React, { memo } from 'react'

export type DefaultTooltipProps = TooltipProps & {title: string | ReactNode}

export default memo(function DefaultTooltip (props: DefaultTooltipProps) {
  return (
    <Tooltip
      {...props}
      enterTouchDelay={0}
      leaveTouchDelay={10000}
      title={(
        <div className="text-base lg:text-lg">
          {props.title}
        </div>
      )}
    />
  )
})
