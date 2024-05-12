import { clsx } from 'clsx'
import React from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

export type Type = 'live' | 'submodule' | 'utility';
export default function TypeChip (props: {type: Type}) {
  const { type } = props
  const color = type === 'live' ? 'bg-primary text-white' : 'bg-secondary text-white'

  const text = type === 'live'
    ? 'Live'
    : type === 'submodule' ? 'Submodule' : 'Utility'

  const explainer = type === 'live'
    ? 'Live modules are meant to be deployed directly using terragrunt'
    : type === 'submodule' ? 'Submodules are meant to be used in your Tofu (Terraform) modules' : 'Do not use utility modules'

  return (
    <DefaultTooltipLazy title={explainer}>
      <div className={clsx('font-medium tracking-wide py-1 px-4 rounded-lg w-fit whitespace-nowrap h-fit text-sm sm:text-base', color)}>
        {text}
      </div>
    </DefaultTooltipLazy>
  )
}
