import Skeleton from '@mui/material/Skeleton'
import { lazy, memo, Suspense } from 'react'

import type { ITimeFromNowFieldProps } from '@/components/fields/time/TimeFromNowField'

const TimeFromNowField = lazy(() => import('./TimeFromNowField'))

export default memo(function TimeFromNowFieldLazy (props: ITimeFromNowFieldProps) {
  return (
    <Suspense
      fallback={(
        <Skeleton
          variant="rounded"
          width={50}
          height={30}
        />
      )}
    >
      <TimeFromNowField {...props}/>
    </Suspense>
  )
})
