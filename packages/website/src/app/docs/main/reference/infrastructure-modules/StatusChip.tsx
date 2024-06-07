import { clsx } from 'clsx'
import React from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

export type Status = 'stable' | 'beta' | 'alpha' | 'deprecated';
export default function StatusChip (props: {status: Status}) {
  const { status } = props
  const color = status === 'stable' ? 'bg-primary text-white' : status === 'beta' ? 'bg-warning text-black' : 'bg-red text-white'

  const text = status === 'stable'
    ? 'Stable'
    : status === 'deprecated'
      ? 'Deprecated'
      : status === 'alpha' ? 'Alpha' : 'Beta'

  const explainer = status === 'stable'
    ? 'Ready for production use!'
    : status === 'deprecated'
      ? 'No longer supported. You should remove this from your stack.'
      : status === 'beta' ? 'Safe for production use but API may change significantly in next major release' : 'Do not use unless you are working directly with Panfactum maintainers on testing'
  return (
    <DefaultTooltipLazy title={explainer}>
      <div className={clsx('font-medium tracking-wide py-1 px-4 rounded-lg w-fit whitespace-nowrap h-fit text-sm sm:text-base', color)}>
        {text}
      </div>
    </DefaultTooltipLazy>
  )
}
