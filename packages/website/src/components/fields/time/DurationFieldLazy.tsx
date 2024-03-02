import Skeleton from '@mui/material/Skeleton'
import { lazy, memo, Suspense } from 'react'

import type { IDurationField } from '@/components/fields/time/DurationField'

const DurationField = lazy(() => import('./DurationField'))

export default memo(function DurationFieldLazy (props: IDurationField) {
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
      <DurationField {...props}/>
    </Suspense>
  )
})
