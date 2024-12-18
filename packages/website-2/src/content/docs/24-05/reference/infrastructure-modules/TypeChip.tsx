import { clsx } from 'clsx'
import React from 'react'
import Tooltip from '@/components/ui/tooltip.tsx'

export type Type = 'direct' | 'submodule' | 'utility'
export default function TypeChip(props: { type: Type }) {
  const { type } = props
  const color =
    type === 'direct'
      ? 'bg-utility-brand-500 text-white'
      : 'bg-utility-gray-500 text-white'

  const text =
    type === 'direct'
      ? 'Direct'
      : type === 'submodule'
        ? 'Submodule'
        : 'Utility'

  const explainer =
    type === 'direct'
      ? 'Direct modules are meant to be deployed directly using terragrunt'
      : type === 'submodule'
        ? 'Submodules are meant to be used in your Tofu (Terraform) modules'
        : 'Do not use utility modules'

  return (
    <Tooltip title={explainer}>
      <div
        className={clsx(
          'font-medium tracking-wide py-1 px-4 rounded-lg w-fit whitespace-nowrap h-fit text-sm sm:text-base',
          color,
        )}
      >
        {text}
      </div>
    </Tooltip>
  )
}
