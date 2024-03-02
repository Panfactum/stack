import type { Theme } from '@mui/material'
import { useMediaQuery } from '@mui/material'

export default function useIsXSmall () {
  return useMediaQuery<Theme>(theme =>
    theme.breakpoints.down('sm')
  )
}
