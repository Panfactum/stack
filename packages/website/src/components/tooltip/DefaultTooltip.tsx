import type { TooltipProps } from '@mui/material'
import Tooltip from '@mui/material/Tooltip'
import type { ReactNode } from 'react'
import React, { memo } from 'react'

export type DefaultTooltipProps = TooltipProps & {title: string | ReactNode, limitWidth?: boolean}

export default memo(function DefaultTooltip (props: DefaultTooltipProps) {
  const { limitWidth = true, title, ...otherProps } = props
  return (
    <Tooltip
      {...otherProps}
      enterTouchDelay={0}
      leaveTouchDelay={10000}
      leaveDelay={250}
      title={(
        <div className={`text-base lg:text-lg py-1 px-1 ${limitWidth ? '' : '!w-fit !max-w-none'}`}>
          {title}
        </div>
      )}
      classes={{ tooltip: `bg-accent ${limitWidth ? '' : '!w-fit !max-w-none'}` }}
    />
  )
})
