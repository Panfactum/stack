import { memo } from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

interface INumberFieldProps {
  value?: number;
}
export default memo(function NumberField (props: INumberFieldProps) {
  const { value } = props
  return (
    <DefaultTooltipLazy title={`${value}`}>
      <div>
        { value
          ? Intl.NumberFormat('en-US', {
            notation: 'compact',
            maximumFractionDigits: 1
          }).format(value)
          : '-'}
      </div>
    </DefaultTooltipLazy>
  )
})
