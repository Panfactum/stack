'use client'

import Button from '@mui/material/Button'
import { memo } from 'react'

export default memo(function BackButton () {
  return (
    <Button
      variant="contained"
      onClick={() => {
        window.history.back()
      }}
    >
      Go Back
    </Button>
  )
})
