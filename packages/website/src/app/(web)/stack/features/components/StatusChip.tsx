import { clsx } from 'clsx'
import React from 'react'

export type Status = 'coming-soon' | 'stable' | 'beta' | 'alpha';
export default function StatusChip (props: {status: Status}) {
  const { status } = props
  const color = status === 'coming-soon'
    ? 'bg-secondary text-white'
    : status === 'stable' ? 'bg-primary text-white' : 'bg-warning text-black'

  const text = status === 'coming-soon'
    ? 'Coming Soon'
    : status === 'stable'
      ? 'Stable'
      : status === 'alpha' ? 'Alpha' : 'Beta'

  return (
    <div className={clsx('font-semibold py-1 px-4 rounded-lg', color)}>
      {text}
    </div>
  )
}
