import type { ReactNode } from 'react'
import { lazy, Suspense } from 'react'

import type { DefaultTooltipProps } from '@/components/tooltip/DefaultTooltip'

const DefaultTooltip = lazy(() => import('./DefaultTooltip'))

type Props = DefaultTooltipProps & {children: ReactNode}

export default function DefaultTooltipLazy ({ children, ...props }: Props) {
  return (
    <Suspense fallback={children}>
      <DefaultTooltip {...props}>
        {children}
      </DefaultTooltip>
    </Suspense>
  )
}
