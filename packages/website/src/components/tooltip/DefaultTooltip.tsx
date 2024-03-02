import type { TooltipProps } from '@mui/material'
import Tooltip from '@mui/material/Tooltip'
import React, { memo } from 'react'

export type DefaultTooltipProps = TooltipProps & {title: string}

export default memo(function DefaultTooltip (props: DefaultTooltipProps) {
  return (
    <Tooltip
      {...props}
      title={(
        <div className="text-base lg:text-lg">
          {props.title}
        </div>
      )}
    />
  )
})
