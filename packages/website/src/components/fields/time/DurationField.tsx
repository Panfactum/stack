import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import { memo } from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

dayjs.extend(duration)
dayjs.extend(relativeTime)
dayjs.extend(utc)

export interface IDurationField {
  fromUnixSeconds?: number | null;
  toUnixSeconds?: number | null;
}
export default memo(function DurationField (props: IDurationField) {
  const { fromUnixSeconds, toUnixSeconds } = props
  const duration = fromUnixSeconds && toUnixSeconds ? dayjs.duration(toUnixSeconds - fromUnixSeconds, 'seconds') : null
  return (
    <div>
      {duration
        ? (
          <DefaultTooltipLazy title={duration.format('DD[d] HH[h] mm[m] ss[s]')}>
            <div>
              {duration.humanize()}
            </div>
          </DefaultTooltipLazy>
        )
        : '-'}
    </div>
  )
})
