import type { Metadata } from 'next'
import { Suspense } from 'react'

import Calculator from './Calculator'

export const metadata: Metadata = {
  title: 'Savings Calculator',
  description: 'Calculate infrastructure cost savings when using the Panfactum Stack'
}

export default function Page () {
  return (
    <div>
      <Suspense>
        <Calculator/>
      </Suspense>
    </div>
  )
}
