import { Suspense } from 'react'

import Calculator from './Calculator'

export default function Page () {
  return (
    <div>
      <Suspense>
        <Calculator/>
      </Suspense>
    </div>
  )
}
