import type { AlertProps } from '@mui/material'
import Alert from '@mui/material/Alert'
import { memo } from 'react'

export default memo(function MarkdownAlert (props: AlertProps) {
  return (
    <div className="w-full py-2">
      <Alert
        {...props}
        variant="filled"
        className="text-xs sm:text-sm w-full py-0.5 flex items-center"
      />
    </div>
  )
})
